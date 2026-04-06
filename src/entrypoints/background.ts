import BookmarkService from '../utils/services'
import { Setting } from '../utils/setting'
import iconLogo from '../assets/icon.png'
import { OperType, BookmarkInfo, SyncDataInfo, RootBookmarksType, BrowserType } from '../utils/models'
import { Bookmarks } from 'wxt/browser'
export default defineBackground(() => {

  browser.runtime.onInstalled.addListener(c => {
  });

  let curOperType = OperType.NONE;
  let curBrowserType = BrowserType.CHROME;
  let uploadDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const AUTO_SYNC_ALARM = 'bookmarkHubAutoSync';

  // ── Icon spinner ──────────────────────────────────────────────────────────
  let spinInterval: ReturnType<typeof setInterval> | null = null;
  let spinAngle = 0;

  async function startIconSpin(color: string) {
    if (spinInterval) return;
    const [bm16, bm32] = await Promise.all([
      fetch(browser.runtime.getURL('icons/16.png')).then(r => r.blob()).then(createImageBitmap),
      fetch(browser.runtime.getURL('icons/32.png')).then(r => r.blob()).then(createImageBitmap),
    ]);
    spinAngle = 0;
    function frame(size: number, bm: ImageBitmap): ImageData {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d')!;
      const c = size / 2;
      const r = size * 0.5;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(bm, 0, 0, size, size);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = size * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(c, c, r, spinAngle, spinAngle + Math.PI * 1.4);
      ctx.stroke();
      return ctx.getImageData(0, 0, size, size);
    }
    spinInterval = setInterval(() => {
      spinAngle += 0.22;
      browser.action.setIcon({ imageData: { 16: frame(16, bm16), 32: frame(32, bm32) } });
    }, 50);
  }

  function stopIconSpin() {
    if (spinInterval) { clearInterval(spinInterval); spinInterval = null; }
    spinAngle = 0;
    browser.action.setIcon({ path: { 16: 'icons/16.png', 32: 'icons/32.png' } });
  }

  setupAutoSyncAlarm();

  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.name === 'upload') {
      curOperType = OperType.SYNC
      startIconSpin('#22c55e');
      uploadBookmarks().then(async (updatedAt) => {
        if (updatedAt) await browser.storage.local.set({ lastRemoteUpdate: updatedAt });
        browser.action.setBadgeText({ text: "" });
        refreshLocalCount();
        sendResponse(true);
      }).catch(() => sendResponse(false)).finally(() => { curOperType = OperType.NONE; stopIconSpin(); });
    }
    if (msg.name === 'download') {
      curOperType = OperType.SYNC
      startIconSpin('#3b82f6');
      downloadBookmarks().then(async (updatedAt) => {
        if (updatedAt) await browser.storage.local.set({ lastRemoteUpdate: updatedAt });
        browser.action.setBadgeText({ text: "" });
        refreshLocalCount();
        sendResponse(true);
      }).catch(() => sendResponse(false)).finally(() => { curOperType = OperType.NONE; stopIconSpin(); });
    }
    if (msg.name === 'removeAll') {
      curOperType = OperType.REMOVE
      clearBookmarkTree().then(() => {
        browser.action.setBadgeText({ text: "" });
        refreshLocalCount();
        sendResponse(true);
      }).catch(() => sendResponse(false)).finally(() => { curOperType = OperType.NONE });
    }
    if (msg.name === 'setting') {
      browser.runtime.openOptionsPage().then(() => {
        sendResponse(true);
      });
    }
    if (msg.name === 'settingChanged') {
      setupAutoSyncAlarm().then(() => sendResponse(true));
    }
    if (msg.name === 'exportBookmarks') {
      getBookmarks().then(bookmarks => {
        const syncdata = new SyncDataInfo();
        syncdata.version = browser.runtime.getManifest().version;
        syncdata.createDate = Date.now();
        syncdata.bookmarks = formatBookmarks(bookmarks);
        syncdata.browser = navigator.userAgent;
        sendResponse({ ok: true, data: JSON.stringify(syncdata, null, 2) });
      }).catch((err: any) => sendResponse({ ok: false, error: err.message }));
    }
    if (msg.name === 'importBookmarks') {
      (async () => {
        try {
          const syncdata: SyncDataInfo = JSON.parse(msg.data);
          if (!syncdata.bookmarks || syncdata.bookmarks.length === 0) {
            sendResponse({ ok: false, error: 'No bookmarks found in file' });
            return;
          }
          curOperType = OperType.SYNC;
          await clearBookmarkTree();
          await createBookmarkTree(syncdata.bookmarks);
          await refreshLocalCount();
          sendResponse({ ok: true });
        } catch (err: any) {
          sendResponse({ ok: false, error: err.message });
        } finally {
          curOperType = OperType.NONE;
        }
      })();
    }
    return true;
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === AUTO_SYNC_ALARM) {
      await checkAndAutoDownload();
    }
  });

  browser.bookmarks.onCreated.addListener((id, info) => {
    if (curOperType === OperType.NONE) {
      browser.action.setBadgeText({ text: "!" });
      browser.action.setBadgeBackgroundColor({ color: "#F00" });
      refreshLocalCount();
      scheduleAutoUpload();
    }
  });
  browser.bookmarks.onChanged.addListener((id, info) => {
    if (curOperType === OperType.NONE) {
      browser.action.setBadgeText({ text: "!" });
      browser.action.setBadgeBackgroundColor({ color: "#F00" });
      scheduleAutoUpload();
    }
  })
  browser.bookmarks.onMoved.addListener((id, info) => {
    if (curOperType === OperType.NONE) {
      browser.action.setBadgeText({ text: "!" });
      browser.action.setBadgeBackgroundColor({ color: "#F00" });
      scheduleAutoUpload();
    }
  })
  browser.bookmarks.onRemoved.addListener((id, info) => {
    if (curOperType === OperType.NONE) {
      browser.action.setBadgeText({ text: "!" });
      browser.action.setBadgeBackgroundColor({ color: "#F00" });
      refreshLocalCount();
      scheduleAutoUpload();
    }
  })

  async function setupAutoSyncAlarm() {
    const setting = await Setting.build();
    if (setting.autoSync && setting.githubToken && setting.gistID) {
      const interval = Number(setting.autoSyncInterval) || 5;
      browser.alarms.create(AUTO_SYNC_ALARM, { periodInMinutes: interval });
    } else {
      browser.alarms.clear(AUTO_SYNC_ALARM);
    }
  }

  function scheduleAutoUpload() {
    if (uploadDebounceTimer) clearTimeout(uploadDebounceTimer);
    uploadDebounceTimer = setTimeout(async () => {
      uploadDebounceTimer = null;
      if (curOperType !== OperType.NONE) return;
      const setting = await Setting.build();
      if (!setting.autoSync || !setting.githubToken || !setting.gistID || !setting.gistFileName) return;
      curOperType = OperType.SYNC;
      startIconSpin('#22c55e');
      try {
        const updatedAt = await uploadBookmarks(true);
        if (updatedAt) await browser.storage.local.set({ lastRemoteUpdate: updatedAt });
      } finally {
        curOperType = OperType.NONE;
        stopIconSpin();
        browser.action.setBadgeText({ text: "" });
        await refreshLocalCount();
      }
    }, 2000);
  }

  async function checkAndAutoDownload() {
    if (curOperType !== OperType.NONE) return;
    // Skip if there are local unsaved changes pending manual review
    const badgeText = await browser.action.getBadgeText({});
    if (badgeText === '!') return;
    const setting = await Setting.build();
    if (!setting.autoSync || !setting.githubToken || !setting.gistID || !setting.gistFileName) return;
    try {
      const gistData = await BookmarkService.get();
      if (!gistData.updatedAt) return;
      const stored = await browser.storage.local.get(['lastRemoteUpdate']);
      if (stored.lastRemoteUpdate === gistData.updatedAt) return;
      curOperType = OperType.SYNC;
      startIconSpin('#3b82f6');
      await downloadBookmarks(true, gistData);
      await browser.storage.local.set({ lastRemoteUpdate: gistData.updatedAt });
    } catch (err) {
      console.error('Auto-sync check failed:', err);
    } finally {
      curOperType = OperType.NONE;
      stopIconSpin();
      browser.action.setBadgeText({ text: "" });
      await refreshLocalCount();
    }
  }

  async function uploadBookmarks(autoSync = false): Promise<string | null> {
    const notifTitle = browser.i18n.getMessage(autoSync ? 'autoSyncUpload' : 'uploadBookmarks');
    try {
      let setting = await Setting.build()
      if (setting.githubToken == '') {
        throw new Error("Gist Token Not Found");
      }
      if (setting.gistID == '') {
        throw new Error("Gist ID Not Found");
      }
      if (setting.gistFileName == '') {
        throw new Error("Gist File Not Found");
      }
      let bookmarks = await getBookmarks();
      let syncdata = new SyncDataInfo();
      syncdata.version = browser.runtime.getManifest().version;
      syncdata.createDate = Date.now();
      syncdata.bookmarks = formatBookmarks(bookmarks);
      syncdata.browser = navigator.userAgent;
      const resp = await BookmarkService.update({
        files: {
          [setting.gistFileName]: {
            content: JSON.stringify(syncdata)
          }
        },
        description: setting.gistFileName
      }) as any;
      const count = getBookmarkCount(syncdata.bookmarks);
      await browser.storage.local.set({ remoteCount: count });
      if (setting.enableNotify) {
        await browser.notifications.create({
          type: "basic",
          iconUrl: iconLogo,
          title: notifTitle,
          message: browser.i18n.getMessage('success')
        });
      }
      return resp?.updated_at || null;
    }
    catch (error: any) {
      console.error(error);
      await browser.notifications.create({
        type: "basic",
        iconUrl: iconLogo,
        title: notifTitle,
        message: `${browser.i18n.getMessage('error')}：${error.message}`
      });
      return null;
    }
  }
  async function downloadBookmarks(autoSync = false, prefetchedGist?: { content: string | null, updatedAt: string | null }): Promise<string | null> {
    const notifTitle = browser.i18n.getMessage(autoSync ? 'autoSyncDownload' : 'downloadBookmarks');
    try {
      const { content: gist, updatedAt } = prefetchedGist ?? await BookmarkService.get();
      let setting = await Setting.build()
      if (gist) {
        let syncdata: SyncDataInfo = JSON.parse(gist);
        if (syncdata.bookmarks == undefined || syncdata.bookmarks.length == 0) {
          if (setting.enableNotify) {
            await browser.notifications.create({
              type: "basic",
              iconUrl: iconLogo,
              title: notifTitle,
              message: `${browser.i18n.getMessage('error')}：Gist File ${setting.gistFileName} is NULL`
            });
          }
          return null;
        }
        await clearBookmarkTree();
        await createBookmarkTree(syncdata.bookmarks);
        const count = getBookmarkCount(syncdata.bookmarks);
        await browser.storage.local.set({ remoteCount: count });
        if (setting.enableNotify) {
          await browser.notifications.create({
            type: "basic",
            iconUrl: iconLogo,
            title: notifTitle,
            message: browser.i18n.getMessage('success')
          });
        }
        return updatedAt;
      }
      else {
        await browser.notifications.create({
          type: "basic",
          iconUrl: iconLogo,
          title: notifTitle,
          message: `${browser.i18n.getMessage('error')}：Gist File ${setting.gistFileName} Not Found`
        });
        return null;
      }
    }
    catch (error: any) {
      console.error(error);
      await browser.notifications.create({
        type: "basic",
        iconUrl: iconLogo,
        title: notifTitle,
        message: `${browser.i18n.getMessage('error')}：${error.message}`
      });
      return null;
    }
  }

  async function getBookmarks() {
    let bookmarkTree: BookmarkInfo[] = await browser.bookmarks.getTree();
    if (bookmarkTree && bookmarkTree[0].id === "root________") {
      curBrowserType = BrowserType.FIREFOX;
    }
    else {
      curBrowserType = BrowserType.CHROME;
    }
    return bookmarkTree;
  }

  async function clearBookmarkTree() {
    try {
      let setting = await Setting.build()
      if (setting.githubToken == '') {
        throw new Error("Gist Token Not Found");
      }
      if (setting.gistID == '') {
        throw new Error("Gist ID Not Found");
      }
      if (setting.gistFileName == '') {
        throw new Error("Gist File Not Found");
      }
      let bookmarks = await getBookmarks();
      let tempNodes: BookmarkInfo[] = [];
      bookmarks[0].children?.forEach(c => {
        c.children?.forEach(d => {
          tempNodes.push(d)
        })
      });
      if (tempNodes.length > 0) {
        for (let node of tempNodes) {
          if (node.id) {
            await browser.bookmarks.removeTree(node.id)
          }
        }
      }
      if (curOperType === OperType.REMOVE && setting.enableNotify) {
        await browser.notifications.create({
          type: "basic",
          iconUrl: iconLogo,
          title: browser.i18n.getMessage('removeAllBookmarks'),
          message: browser.i18n.getMessage('success')
        });
      }
    }
    catch (error: any) {
      console.error(error);
      await browser.notifications.create({
        type: "basic",
        iconUrl: iconLogo,
        title: browser.i18n.getMessage('removeAllBookmarks'),
        message: `${browser.i18n.getMessage('error')}：${error.message}`
      });
    }
  }

  async function createBookmarkTree(bookmarkList: BookmarkInfo[] | undefined) {
    if (bookmarkList == null) {
      return;
    }
    for (let i = 0; i < bookmarkList.length; i++) {
      let node = bookmarkList[i];
      if (node.title == RootBookmarksType.MenuFolder
        || node.title == RootBookmarksType.MobileFolder
        || node.title == RootBookmarksType.ToolbarFolder
        || node.title == RootBookmarksType.UnfiledFolder) {
        if (curBrowserType == BrowserType.FIREFOX) {
          switch (node.title) {
            case RootBookmarksType.MenuFolder:
              node.children?.forEach(c => c.parentId = "menu________");
              break;
            case RootBookmarksType.MobileFolder:
              node.children?.forEach(c => c.parentId = "mobile______");
              break;
            case RootBookmarksType.ToolbarFolder:
              node.children?.forEach(c => c.parentId = "toolbar_____");
              break;
            case RootBookmarksType.UnfiledFolder:
              node.children?.forEach(c => c.parentId = "unfiled_____");
              break;
            default:
              node.children?.forEach(c => c.parentId = "unfiled_____");
              break;
          }
        } else {
          switch (node.title) {
            case RootBookmarksType.MobileFolder:
              node.children?.forEach(c => c.parentId = "3");
              break;
            case RootBookmarksType.ToolbarFolder:
              node.children?.forEach(c => c.parentId = "1");
              break;
            case RootBookmarksType.UnfiledFolder:
            case RootBookmarksType.MenuFolder:
              node.children?.forEach(c => c.parentId = "2");
              break;
            default:
              node.children?.forEach(c => c.parentId = "2");
              break;
          }
        }
        await createBookmarkTree(node.children);
        continue;
      }

      let res: Bookmarks.BookmarkTreeNode = { id: '', title: '' };
      try {
        /* 处理firefox中创建 chrome://chrome-urls/ 格式的书签会报错的问题 */
        res = await browser.bookmarks.create({
          parentId: node.parentId,
          title: node.title,
          url: node.url
        });
      } catch (err) {
        console.error(res, err);
      }
      if (res.id && node.children && node.children.length > 0) {
        node.children.forEach(c => c.parentId = res.id);
        await createBookmarkTree(node.children);
      }
    }
  }

  function getBookmarkCount(bookmarkList: BookmarkInfo[] | undefined) {
    let count = 0;
    if (bookmarkList) {
      bookmarkList.forEach(c => {
        if (c.url) {
          count = count + 1;
        }
        else {
          count = count + getBookmarkCount(c.children);
        }
      });
    }
    return count;
  }

  async function refreshLocalCount() {
    let bookmarkList = await getBookmarks();
    const count = getBookmarkCount(bookmarkList);
    await browser.storage.local.set({ localCount: count });
  }


  function formatBookmarks(bookmarks: BookmarkInfo[]): BookmarkInfo[] | undefined {
    if (bookmarks[0].children) {
      for (let a of bookmarks[0].children) {
        switch (a.id) {
          case "1":
          case "toolbar_____":
            a.title = RootBookmarksType.ToolbarFolder;
            break;
          case "menu________":
            a.title = RootBookmarksType.MenuFolder;
            break;
          case "2":
          case "unfiled_____":
            a.title = RootBookmarksType.UnfiledFolder;
            break;
          case "3":
          case "mobile______":
            a.title = RootBookmarksType.MobileFolder;
            break;
        }
      }
    }

    let a = format(bookmarks[0]);
    return a.children;
  }

  function format(b: BookmarkInfo): BookmarkInfo {
    b.dateAdded = undefined;
    b.dateGroupModified = undefined;
    b.id = undefined;
    b.index = undefined;
    b.parentId = undefined;
    b.type = undefined;
    b.unmodifiable = undefined;
    if (b.children && b.children.length > 0) {
      b.children?.map(c => format(c))
    }
    return b;
  }
  ///暂时不启用自动备份
  /*
  async function backupToLocalStorage(bookmarks: BookmarkInfo[]) {
      try {
          let syncdata = new SyncDataInfo();
          syncdata.version = browser.runtime.getManifest().version;
          syncdata.createDate = Date.now();
          syncdata.bookmarks = formatBookmarks(bookmarks);
          syncdata.browser = navigator.userAgent;
          const keyname = 'BookmarkHub_backup_' + Date.now().toString();
          await browser.storage.local.set({ [keyname]: JSON.stringify(syncdata) });
      }
      catch (error:any) {
          console.error(error)
      }
  }
  */

});
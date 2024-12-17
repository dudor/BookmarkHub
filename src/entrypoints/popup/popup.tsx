import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client';
import { Dropdown, Badge } from 'react-bootstrap';
import { IconContext } from 'react-icons'
import {
    AiOutlineCloudUpload, AiOutlineCloudDownload,
    AiOutlineCloudSync, AiOutlineSetting, AiOutlineClear,
    AiOutlineInfoCircle, AiOutlineGithub
} from 'react-icons/ai'
import 'bootstrap/dist/css/bootstrap.min.css';
import './popup.css'
const Popup: React.FC = () => {
    const [count, setCount] = useState({ local: "0", remote: "0" })
    useEffect(() => {
        document.addEventListener('click', (e: MouseEvent) => {
            let elem = e.target as HTMLInputElement;
            if (elem != null && elem.className === 'dropdown-item') {
                elem.setAttribute('disabled', 'disabled');
                browser.runtime.sendMessage({ name: elem.name })
                    .then((res) => {
                        elem.removeAttribute('disabled');
                        console.log("msg", Date.now())
                    })
                    .catch(c => {
                        console.log("error", c)
                    });
            }
        });
    }, [])
    useEffect(() => {
        let getSetting = async () => {
            let data = await browser.storage.local.get(["localCount", "remoteCount"]);
            setCount({ local: data["localCount"], remote: data["remoteCount"] });
        }
        getSetting();
    }, [])
    return (
        <IconContext.Provider value={{ className: 'dropdown-item-icon' }}>
            <Dropdown.Menu show>
                <Dropdown.Item name='upload' as="button" title={browser.i18n.getMessage('uploadBookmarksDesc')}><AiOutlineCloudUpload />{browser.i18n.getMessage('uploadBookmarks')}</Dropdown.Item>
                <Dropdown.Item name='download' as="button" title={browser.i18n.getMessage('downloadBookmarksDesc')}><AiOutlineCloudDownload />{browser.i18n.getMessage('downloadBookmarks')}</Dropdown.Item>
                <Dropdown.Item name='removeAll' as="button" title={browser.i18n.getMessage('removeAllBookmarksDesc')}><AiOutlineClear />{browser.i18n.getMessage('removeAllBookmarks')}</Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item name='setting' as="button"><AiOutlineSetting />{browser.i18n.getMessage('settings')}</Dropdown.Item>
                <Dropdown.ItemText>
                    <AiOutlineInfoCircle /><a href="https://github.com/dudor/BookmarkHub" target="_blank">{browser.i18n.getMessage('help')}</a>|
                    <Badge id="localCount" variant="light" title={browser.i18n.getMessage('localCount')}>{count["local"]}</Badge>/<Badge id="remoteCount" variant="light" title={browser.i18n.getMessage('remoteCount')}>{count["remote"]}</Badge>|
                    <a href="https://github.com/dudor" target="_blank" title={browser.i18n.getMessage('author')}><AiOutlineGithub /></a>
                </Dropdown.ItemText>
            </Dropdown.Menu >
        </IconContext.Provider>
    )
}


ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>,
);



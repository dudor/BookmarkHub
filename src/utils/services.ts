import { Setting } from './setting'
import { http } from './http'
class BookmarkService {
    async get(): Promise<{ content: string | null, updatedAt: string | null }> {
        let setting = await Setting.build();
        let resp = await http.get(`gists/${setting.gistID}`).json() as any;
        const updatedAt: string | null = resp?.updated_at || null;
        if (resp?.files) {
            let filenames = Object.keys(resp.files);
            if (filenames.indexOf(setting.gistFileName) !== -1) {
                let gistFile = resp.files[setting.gistFileName]
                if (gistFile.truncated) {
                    const content = await http.get(gistFile.raw_url, {prefixUrl: ''}).text();
                    return { content, updatedAt };
                } else {
                    return { content: gistFile.content, updatedAt };
                }
            }
        }
        return { content: null, updatedAt };
    }
    async getAllGist() {
        return http.get('gists').json();
    }
    async update(data: any) {
        let setting = await Setting.build();
        return http.patch(`gists/${setting.gistID}`, { json: data }).json();
    }
}

export default new BookmarkService()
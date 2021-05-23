import { Setting } from './setting'
import axios from './http'
class BookmarkService {
    async get() {
        let setting = await Setting.build();
        let resp = await axios.get(`/gists/${setting.gistID}`)
        if (resp && resp.data) {
            let filenames = Object.keys(resp.data.files);
            if (filenames.indexOf(setting.gistFileName) !== -1) {
                let gistFile = resp.data.files[setting.gistFileName]
                if (gistFile.truncated) {
                    return axios.get(gistFile.raw_url, { responseType: 'blob' }).then(resp => resp.data.text())
                } else {
                    return gistFile.content
                }
            }
        }
    }
    async getAllGist() {
        return axios.get('/gists').then(resp => resp.data)
    }
    async update(data: any) {
        let setting = await Setting.build();
        return axios.patch(`/gists/${setting.gistID}`, data).then(resp => resp.data)
    }
}

export default new BookmarkService()
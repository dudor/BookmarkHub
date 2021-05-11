import { Setting } from './setting'
import axios from './http'
class BookmarkService {
    async get() {
        let setting = await Setting.build();
        return axios.get(`/gists/${setting.gistID}`).then(resp => resp.data)
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
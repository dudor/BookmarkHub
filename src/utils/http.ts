import axios from 'axios'
import { Setting } from './setting'
let axiosObj = axios.create({
  timeout: 60000,
});

axiosObj.interceptors.request.use(async cfg => {
  let setting = await Setting.build();
  cfg.baseURL = setting.githubURL;
  cfg.headers.post['Content-Type'] = "application/json;charset=UTF-8";
  cfg.headers.common['Authorization'] = `token ${setting.githubToken}`;
  cfg.headers.common['Accept'] = `application/vnd.github.v3+json`;
  return cfg;
},
  error => {
    console.error(error)
    return Promise.reject(error);
  })

axiosObj.interceptors.response.use(function (response) {
  // Any status code that lie within the range of 2xx cause this function to trigger
  // Do something with response data
  if (response.status === 200) {
    return Promise.resolve(response)
  }
  else {
    console.warn('response', response);
    return Promise.reject(response)
  }
}, function (error) {
  // Any status codes that falls outside the range of 2xx cause this function to trigger
  // Do something with response error
  console.error('error', error)
  if (error.response) {
    error = { ...error, ...error.response.data }
  }
  return Promise.reject(error);
});

export default axiosObj
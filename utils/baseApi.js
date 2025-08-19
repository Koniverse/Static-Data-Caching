import axios from "axios";

const createApiRequest = async ({ url, method, data, params, headers }) => {
  try {
    const { data: resp } = await axios({
      method,
      url: url,
      data,
      params,
      headers,
    });

    return {
      success: true,
      data: resp,
    };
  } catch (e) {
    console.error(e?.message);
    const { response } = e;
    const message = response ? response.statusText : e.message || e;
    const _data = response ? response.data : '';
    return {
      success: false,
      message,
      _data,
    };
  }
};

export default createApiRequest;

import { Logger, request } from '@faasjs/utils';
import * as crypto from 'crypto';

function mergeData(data: any, prefix: string = '') {
  const ret: any = {};
  for (const k in data) {
    if (data[k] === null) {
      continue;
    }
    if (data[k] instanceof Array || data[k] instanceof Object) {
      Object.assign(ret, mergeData(data[k], prefix + k + '.'));
    } else {
      ret[prefix + k] = data[k];
    }
  }
  return ret;
}

function formatSignString(params: any) {
  const str: string[] = [];

  for (const key of Object.keys(params).sort()) {
    str.push(key + '=' + params[key]);
  }

  return str.join('&');
}

/**
 * 发出请求
 *
 * @param logger {Logger} 日志类实例
 * @param config {object} 服务商基本参数
 * @param config.region {string} 区域
 * @param config.secretId {string} secretId
 * @param config.secretKey {string} secretKey
 * @param params {object} 请求参数
 */
const action = function (logger: Logger, config: any, params: any) {
  logger.debug('%o', params);

  params = Object.assign({
    Nonce: Math.round(Math.random() * 65535),
    Region: config.region,
    SecretId: config.secretId,
    SignatureMethod: 'HmacSHA256',
    Timestamp: Math.round(Date.now() / 1000) - 1,
    Version: '2018-04-16',
  }, params);
  params = mergeData(params);

  const sign = 'POSTapigateway.api.qcloud.com/v2/index.php?' + formatSignString(params);

  params.Signature = crypto.createHmac('sha256', config.secretKey).update(sign).digest('base64');

  return request('https://apigateway.api.qcloud.com/v2/index.php?', {
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  }).then(function (res) {
    const body = JSON.parse(res.body);
    if (body.code) {
      throw Error(JSON.stringify(body));
    } else {
      return body;
    }
  });
};

/**
 * 发布 API 接口
 * @param provider {object} 服务商配置
 * @param trigger {object} 网关接口配置
 */
const deploy = async function (provider: any, trigger: any) {
  const logger = new Logger('@faasjs/tencentcloud-apigateway:deploy:' + trigger.name);

  logger.debug('开始发布\n\nprovider:\n%o\n\ntrigger:\n%o', provider, trigger);

  const config: {
    appId: string;
    region: string;
    secretId: string;
    secretKey: string;
  } = {
    appId: provider.config.appId,
    region: provider.config.region,
    secretId: provider.config.secretId,
    secretKey: provider.config.secretKey,
  };

  for (const key of ['appId', 'region', 'secretId', 'secretKey']) {
    if (!config[key]) {
      throw Error(`${key} required`);
    }
  }

  trigger.resource.config['requestConfig.path'] = trigger.path || '/' + trigger.deploy.name;
  trigger.resource.config.apiName = trigger.functionName;
  trigger.resource.config.serviceScfFunctionName = trigger.functionName;

  logger.debug('查询网关接口是否存在');

  const api = await action(logger, config, {
    Action: 'DescribeApisStatus',
    searchName: trigger.resource.config['requestConfig.path'],
    serviceId: trigger.resource.config.serviceId,
  }).then(function (body) {
    return body.apiIdStatusSet.filter(function (item: any) {
      return item.path === trigger.resource.config['requestConfig.path'];
    })[0];
  });

  if (api) {
    logger.debug('更新网关接口');

    await action(logger, config, Object.assign(trigger.resource.config, {
      Action: 'ModifyApi',
      apiId: api.apiId,
    }));
  } else {
    logger.debug('创建网关接口');

    await action(logger, config, Object.assign(trigger.resource.config, {
      Action: 'CreateApi',
    }));
  }

  logger.debug('发布网关');

  await action(logger, config, {
    Action: 'ReleaseService',
    environmentName: 'release',
    releaseDesc: trigger.functionName,
    serviceId: trigger.resource.config.serviceId,
  });

  return true;
};

export {
  action,
  deploy,
};

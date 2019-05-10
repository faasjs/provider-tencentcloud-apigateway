import { deploy } from '../index';

jest.mock(process.cwd() + '/node_modules/@faasjs/request', () => {
  return async function () {
    return {
      body: '{"apiIdStatusSet":[{"apiId":"apiId","path":"/"}]}'
    };
  };
});

test.each(['region', 'secretId', 'secretKey'])('%s', async function (key) {
  try {
    await deploy('testing', {
      resource: {
        provider: {
          config: {
            [key]: key
          },
          type: 'tencentcloud',
        }
      },
    });
  } catch (error) {
    expect(error.message).toEqual('appId required');
  }
});

test('should work', async function () {
  const res = await deploy('testing', {
    name: 'name',
    resource: {
      config: {
      },
      provider: {
        config: {
          appId: 'appId',
          region: 'ap-beijing',
          secretId: 'secretId',
          secretKey: 'secretKey',
        },
        type: 'tencentcloud'
      }
    }
  });
  expect(res).toBeTruthy();
});

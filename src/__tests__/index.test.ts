import { deploy } from '../index';

test.each(['region', 'secretId', 'secretKey'])('%s required', async function (key) {
  try {
    await deploy({
      config: {
        [key]: key,
      },
      type: 'tencentcloud',
    }, {});
  } catch (error) {
    expect(error.message).toEqual('appId required');
  }
});

test('should work', async function () {
  try {
    await deploy({
      config: {
        appId: 'appId',
        region: 'ap-beijing',
        secretId: 'secretId',
        secretKey: 'secretKey',
      },
      type: 'tencentcloud',
    }, {
        deploy: {
          name: 'name',
        },
        resource: {
          config: {},
        },
      });
  } catch (error) {
    expect(error.message).toContain('4104');
  }
});

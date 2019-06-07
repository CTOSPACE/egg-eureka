'use strict'

const Eureka = require('eureka-js-client').Eureka
const os = require('os')
const ip = require('./ip')

const clientDesc = config => {
  if (config.host && config.port) {
    return `${config.host}:${config.port}`
  } else if (config.serviceUrls) {
    return config.serviceUrls
  } else {
    return 'unknow server!!'
  }
}

const eurekaUtil = {
  getRootUrlByVipAdress (client, vipAddress) {
    const instances = client.getInstancesByVipAddress(vipAddress)
    client.logger.info(
      `get instances for vipAddress [${vipAddress}]: `,
      instances
    )
    const oneInstance = this.getOneInstanceFromAll(instances)
    return this.getServerPath(oneInstance)
  },

  /**
   * 获取某个可用服务,随机取
   * @param {*} instances 所有实例
   * @return {*} json
   */
  getOneInstanceFromAll (instances) {
    if (instances != null) {
      const upInstances = []
      for (const i of instances) {
        if (i.status.toUpperCase() === 'UP') {
          upInstances.push(i)
        }
      }
      if (upInstances.length > 0) {
        const instanceIndex =
          upInstances.length === 1 ? 0 : Date.now() % upInstances.length
        return upInstances[instanceIndex]
      }
      return ''
    }
    return ''
  },

  /** Thanks to  coordinator-node-client */
  /**
   * 根据实例获取一个完整的ip方式的服务地址。
   * @param {*} instance  app的实例。
   * @return {string}  url地址,包括协议，ip和端口。例如:http://192.168.1.100:8080。
   */
  getServerPath (instance) {
    let url = ''
    const http = 'http://'
    const https = 'https://'
    if (instance) {
      if (instance.port && instance.port['@enabled'] === 'true') {
        url = http + instance.ipAddr + ':' + instance.port.$
      } else if (
        instance.securePort &&
        instance.securePort['@enabled'] === 'true'
      ) {
        url = https + instance.ipAddr + ':' + instance.securePort.$
      }
    }
    return url
  }
}

function init (agent) {
  agent.eurekaLogger = agent.getLogger('eureka') || agent.logger
  agent.messenger.on('egg-ready', info => {
    agent.eurekaLogger.info('egg-ready', info)

    agent.addSingleton('eureka', (config, app) => {
      const { eureka } = config
      const done = app.readyCallback('eureka')
      constructConfig(config, info, agent)
      app.eurekaLogger.info('[egg-eureka] regist with config %j', config)
      const client = new Eureka({
        logger: app.eurekaLogger,
        ...config
      })
      client.start(error => {
        if (!error) {
          app.eurekaLogger.info(
            '[egg-eureka] server %j status OK.', clientDesc(eureka)
          )
          renewEurekaInstances()
        } else {
          app.eurekaLogger.error(error)
        }
        done(error, client)
      })
      return client
    })

    agent.eureka.on('registryUpdated', renewEurekaInstances)
  })

  // 获取需要订阅的微服务实例信息
  function renewEurekaInstances () {
    const subscribe = agent.config.eurekaClient.subscribe
    for (const key in subscribe) {
      let app = subscribe[key]
      const vipAddress = app.dataId
      agent.logger.info('getInstancesByVipAddress: %s', vipAddress)
      const instances = agent.eureka.getInstancesByVipAddress(vipAddress)
      agent.eurekaClient.publish({
        dataId: app.dataId,
        publishData: instances
      })
    }
  }
}

function constructConfig (config, loadInfo, app) {
  const hostname = os.hostname()
  const ipAddr = ip.getIPAddress()
  const { port = 7001 } = loadInfo
  const defaultInstance = {
    instanceId: `${hostname}:${app.name}:${port}`,
    app: app.name,
    hostName: ipAddr,
    ipAddr: ipAddr,
    // preferIpAddress: true, // default is false and host will be used.
    // homePageUrl: `http://${ipAddr}:${port}/`,
    statusPageUrl: `http://${ipAddr}:${port}/status`,
    // healthCheckUrl: `http://${ipAddr}:${port}/health`,
    port: {
      $: port,
      '@enabled': 'true'
    },
    // Important, otherwise spring-apigateway cannot find instance of application
    vipAddress: app.name,
    // secureVipAddress: app.name,
    dataCenterInfo: {
      '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
      name: 'MyOwn'
    }
  }

  config.instance = Object.assign(defaultInstance, config.instance)
  return config
}

module.exports = {
  eureka: app => {
    init(app)
  },
  eurekaUtil
}

'use strict'
const name = 'DescendingPriceAuction'
const version = 'v1.0'

/* eslint-disable arrow-body-style */
module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  await deploy(name, {
    from: deployer,
    log: true
  })
}
module.exports.tags = [`${name}-${version}`]

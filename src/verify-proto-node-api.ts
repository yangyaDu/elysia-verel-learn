import { ProtoHandRange } from '@zenithstrat/proto-poker-range-bun-node-api'

if (typeof ProtoHandRange !== 'function') {
  throw new Error('Node-API package loaded but ProtoHandRange is not available')
}

console.info('Loaded @zenithstrat/proto-poker-range-bun-node-api successfully')

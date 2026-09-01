import { ProtoHandRange } from '@yangyadu/proto-poker-range-bun-node-api'

if (typeof ProtoHandRange !== 'function') {
  throw new Error('Node-API package loaded but ProtoHandRange is not available')
}

console.info('Loaded @yangyadu/proto-poker-range-bun-node-api successfully')

import * as Minio from 'minio'

export function getMinioClient() {
  const endpoint = process.env.MINIO_ENDPOINT || 'localhost'
  const port = parseInt(process.env.MINIO_PORT || '9000')
  const useSSL = process.env.MINIO_USE_SSL === 'true'
  const accessKey = process.env.MINIO_ACCESS_KEY
  const secretKey = process.env.MINIO_SECRET_KEY

  if (!accessKey || !secretKey) {
    return null
  }

  return new Minio.Client({
    endPoint: endpoint,
    port: port,
    useSSL: useSSL,
    accessKey: accessKey,
    secretKey: secretKey,
  })
}

export const MINIO_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'documents'

'use server'

import { v2 as cloudinary } from 'cloudinary'
import { auth } from '@clerk/nextjs/server'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
})

export async function uploadProductImage(formData: FormData): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) throw new Error('No file provided')
  if (file.size > 5 * 1024 * 1024) throw new Error('File must be under 5 MB')

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `hardware-pos/products/${ORG_ID}`,
        resource_type: 'image',
        transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload failed'))
        resolve(result.secure_url)
      }
    )
    uploadStream.end(buffer)
  })
}

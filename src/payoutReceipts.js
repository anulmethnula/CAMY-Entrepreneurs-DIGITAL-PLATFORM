import { api } from './api'

export const payoutReceiptTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
function friendlyFailure(error) {
  if(error.status===413)return new Error('This receipt is larger than the storage service can process. Please upload another copy.')
  if(/cannot reach|took too long|network|failed to fetch/i.test(error.message))return new Error('The upload was interrupted. Please check your connection and try again.')
  if(/CAMY could not/i.test(error.message))return new Error('Receipt upload failed. Please try again.')
  return error
}
function base64(bytes) {
  let binary=''
  for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192))
  return btoa(binary)
}
export async function uploadPayoutReceipt(orderId,file,staged,onStage) {
  if(!payoutReceiptTypes.includes(file.type))throw new Error('Please upload a JPG, PNG, WebP or PDF receipt.')
  const endpoint=`/marketplace/orders/${encodeURIComponent(orderId)}/payout-upload`
  const post=(path,data)=>api(path,{method:'POST',timeoutMs:60000,body:JSON.stringify(data)})
  try {
    let upload=staged?.file===file?staged:null
    if(!upload){const result=await post(endpoint,{mime:file.type,size:file.size,name:file.name});upload={file,token:result.uploadId};onStage(upload)}
    let state=await post(`${endpoint}/${upload.token}`,{action:'status'})
    if(state.ready)return upload.token
    // Chunking limits request memory/body size, not the size of a receipt file.
    const chunkSize=256*1024
    for(let offset=Number(state.offset);offset<file.size;){
      const bytes=new Uint8Array(await file.slice(offset,offset+chunkSize).arrayBuffer())
      state=await post(`${endpoint}/${upload.token}`,{action:'chunk',offset,bytes:base64(bytes)})
      if(!Number.isSafeInteger(state.offset)||state.offset<=offset||state.offset>file.size)throw new Error('Receipt upload was interrupted. Please try again.')
      offset=state.offset
    }
    await post(`${endpoint}/${upload.token}`,{action:'finish'})
    return upload.token
  }catch(error){throw friendlyFailure(error)}
}
export function cancelPayoutReceipt(orderId,upload) {
  if(!upload?.token)return
  return api(`/marketplace/orders/${encodeURIComponent(orderId)}/payout-upload/${upload.token}`,{method:'POST',body:JSON.stringify({action:'cancel'})}).catch(()=>{})
}

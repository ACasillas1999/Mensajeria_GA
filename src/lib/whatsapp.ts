import 'dotenv/config'
import axios from 'axios'

const base = `https://graph.facebook.com/${process.env.WABA_VERSION || 'v20.0'}`
const auth = { Authorization: `Bearer ${process.env.WABA_TOKEN}` }

export async function sendText({ to, body }: { to: string, body: string }) {
  const url = `${base}/${process.env.WABA_PHONE_NUMBER_ID}/messages`
  const res = await axios.post(url, {
    messaging_product: 'whatsapp',
    to, type: 'text',
    text: { body }
  }, {
    headers: { Authorization: `Bearer ${process.env.WABA_TOKEN}`, 'Content-Type': 'application/json' }
  })
  return res.data
}


export async function sendImageLink({ to, link, caption = '' }: {
  to: string, link: string, caption?: string
}) {
  const url = `${base}/${process.env.WABA_PHONE_NUMBER_ID}/messages`
  const res = await axios.post(url, {
    messaging_product: 'whatsapp',
    to, type: 'image',
    image: { link, caption }
  }, { headers: { ...auth, 'Content-Type': 'application/json' } })
  return res.data
}

export async function sendDocumentLink({ to, link, caption = '', filename }: {
  to: string, link: string, caption?: string, filename?: string
}) {
  const url = `${base}/${process.env.WABA_PHONE_NUMBER_ID}/messages`
  const document: any = { link, caption };
  if (filename) document.filename = filename;

  const res = await axios.post(url, {
    messaging_product: 'whatsapp',
    to, type: 'document',
    document
  }, { headers: { ...auth, 'Content-Type': 'application/json' } })
  return res.data
}

export async function sendAudioLink({ to, link }: {
  to: string, link: string
}) {
  const url = `${base}/${process.env.WABA_PHONE_NUMBER_ID}/messages`
  const res = await axios.post(url, {
    messaging_product: 'whatsapp',
    to, type: 'audio',
    audio: { link }
  }, { headers: { ...auth, 'Content-Type': 'application/json' } })
  return res.data
}

export async function sendVideoLink({ to, link, caption = '' }: {
  to: string, link: string, caption?: string
}) {
  const url = `${base}/${process.env.WABA_PHONE_NUMBER_ID}/messages`
  const res = await axios.post(url, {
    messaging_product: 'whatsapp',
    to, type: 'video',
    video: { link, caption }
  }, { headers: { ...auth, 'Content-Type': 'application/json' } })
  return res.data
}




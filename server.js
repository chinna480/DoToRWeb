const express = require('express')
const cors = require('cors')
const fetch = require('node-fetch')

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))

const API_KEY = 'RbvyZAWpEo4hTXdiYngCPFLJlweN05cqz7fU3Hja2O6mxK9tBk1xwTlzqNpiFtSEdeJm5uXWKPsvOIDG'

app.post('/send-otp', async (req, res) => {
  const { phone, otp } = req.body

  try {
    const response = await fetch(
      `https://www.fast2sms.com/dev/bulkV2?authorization=${API_KEY}&variables_values=${otp}&route=otp&numbers=${phone}`,
      { method: 'GET' }
    )
    const data = await response.json()

    if (data.return === true) {
      res.json({ success: true, message: 'OTP Sent!' })
    } else {
      res.json({ success: false, message: 'Failed!' })
    }
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
})

app.listen(3000, () => {
  console.log('DoToR Server running on port 3000!')
})
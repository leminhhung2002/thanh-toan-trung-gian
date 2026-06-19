const TRANSFER_CONTENT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function createRandomTransferSuffix() {
  return Array.from({ length: 3 }, () => {
    const index = Math.floor(Math.random() * TRANSFER_CONTENT_ALPHABET.length)
    return TRANSFER_CONTENT_ALPHABET[index]
  }).join('')
}

export function createDepositTransferContent(
  randomSource: () => string = createRandomTransferSuffix,
) {
  const rawSuffix = randomSource().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const suffix = rawSuffix.slice(0, 3).padEnd(3, '0')

  return `CHUYENTIEN${suffix}`
}

const crypto    = require('crypto')
const { query, withTransaction } = require('../config/db')

const GENESIS_HASH = '0'.repeat(64)

// Block-ийн hash тооцоо — Bitcoin/Ethereum-ийн адил агуулгууд оруулж SHA-256
const computeBlockHash = (blockNumber, prevHash, contractHash, timestamp) => {
  const payload = `${blockNumber}|${prevHash}|${contractHash}|${
    timestamp instanceof Date ? timestamp.toISOString() : timestamp
  }`
  return crypto.createHash('sha256').update(payload).digest('hex')
}

// Шинэ block үүсгэж blockchain_ledger-д INSERT хийнэ
// → амжилттай үед { block_id, block_number, block_hash, previous_hash, timestamp }
//
// Race condition-аас сэргийлэх: транзакцийн дотор LOCK TABLE EXCLUSIVE-ээр
// гинжний хүснэгтийг бүхэлд нь түгжинэ. Зэрэгцээ confirmation 2 ширхэг
// "block N+1" үүсгэхгүй (хоёр форк гарахаас сэргийлнэ).
const addBlock = (contractId, contractHash) =>
  withTransaction(async (db) => {
    // 1. Хүснэгтийг бүхэлд нь EXCLUSIVE lock — INSERT-үүд серилаар явна
    await db.query('LOCK TABLE blockchain_ledger IN EXCLUSIVE MODE')

    // 2. Сүүлийн блок татах
    const lastRes = await db.query(
      `SELECT block_number, block_hash
       FROM blockchain_ledger
       ORDER BY block_number DESC
       LIMIT 1`
    )
    const last = lastRes.rows[0]

    const blockNumber = (last?.block_number || 0) + 1
    const prevHash    = last?.block_hash || GENESIS_HASH
    const timestamp   = new Date()
    const blockHash   = computeBlockHash(blockNumber, prevHash, contractHash, timestamp)

    // 3. INSERT
    const insRes = await db.query(
      `INSERT INTO blockchain_ledger
         (block_number, previous_hash, contract_id, contract_hash, timestamp, block_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING block_id, block_number, previous_hash, contract_hash, timestamp, block_hash`,
      [blockNumber, prevHash, contractId, contractHash, timestamp, blockHash]
    )
    return insRes.rows[0]
  })

// Block-ийн integrity шалгах — hash-ыг recompute хийж DB-ийн утгатай харьцуулна
const verifyBlock = (block) => {
  if (!block) return false
  const recomputed = computeBlockHash(
    block.block_number,
    block.previous_hash,
    block.contract_hash,
    block.timestamp
  )
  return recomputed === block.block_hash
}

// Бүх chain-ийг шалгах (audit) — нэг блок ч зөрчилтэй бол false
const verifyEntireChain = async () => {
  const res = await query(
    `SELECT block_number, previous_hash, contract_hash, timestamp, block_hash
     FROM blockchain_ledger
     ORDER BY block_number ASC`
  )
  let expectedPrev = GENESIS_HASH
  for (const b of res.rows) {
    if (b.previous_hash !== expectedPrev) return { valid: false, at: b.block_number, reason: 'prev_mismatch' }
    if (!verifyBlock(b))                  return { valid: false, at: b.block_number, reason: 'hash_mismatch' }
    expectedPrev = b.block_hash
  }
  return { valid: true, total: res.rows.length }
}

// ══════════════════════════════════════════════════════
// Жинхэнэ EVM testnet анкор (сонголтоор) — BLOCKCHAIN_MODE=testnet
// ══════════════════════════════════════════════════════
// Дотоод SHA-256 ledger (дээрх) хэвээр үлдэнэ. Үүн дээр нэмж, гэрээний
// hash-ыг жинхэнэ testnet (ж: Polygon Amoy) рүү анкорлоно. Гэрээний агуулга
// биш — зөвхөн 32 byte SHA-256 hash гүйлгээний calldata-д гарна (нууцлал).
//   Орчны хувьсагч:
//     BLOCKCHAIN_MODE=testnet         (эс бөгөөс анкор алгасна → null)
//     BLOCKCHAIN_RPC_URL=https://...  (Amoy RPC, ж: Alchemy/нийтийн)
//     WALLET_PRIVATE_KEY=0x...        (faucet-аас цэнэглэсэн testnet хэтэвч)
//     BLOCKCHAIN_NETWORK=amoy         (explorer/шошго; default 'amoy')
const anchorOnChain = async (contractHash) => {
  if ((process.env.BLOCKCHAIN_MODE || 'simulation') !== 'testnet') return null

  const rpcUrl     = process.env.BLOCKCHAIN_RPC_URL
  const privateKey = process.env.WALLET_PRIVATE_KEY
  const network    = process.env.BLOCKCHAIN_NETWORK || 'amoy'
  if (!rpcUrl || !privateKey) {
    console.error('BLOCKCHAIN_MODE=testnet ч BLOCKCHAIN_RPC_URL / WALLET_PRIVATE_KEY дутуу')
    return null
  }

  // ethers-ийг зөвхөн testnet 
  const { ethers } = require('ethers')
  const provider   = new ethers.JsonRpcProvider(rpcUrl)
  const wallet     = new ethers.Wallet(privateKey, provider)


  const tx = await wallet.sendTransaction({
    to:    wallet.address,
    value: 0,
    data:  '0x' + contractHash,
  })
  return { txHash: tx.hash, network }
}

// Block-ийн мөрд жинхэнэ on-chain tx hash-ыг хадгална (анкор амжилттай үед)
const setBlockOnchainTx = (blockId, txHash, network) =>
  query(
    `UPDATE blockchain_ledger
     SET onchain_tx_hash = $2, onchain_network = $3
     WHERE block_id = $1`,
    [blockId, txHash, network]
  )

module.exports = {
  GENESIS_HASH,
  computeBlockHash,
  addBlock,
  verifyBlock,
  verifyEntireChain,
  anchorOnChain,
  setBlockOnchainTx,
}

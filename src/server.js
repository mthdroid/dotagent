// DotAgent — Express Web Server
// AI-Powered DeFi Agent for Polkadot Hub

import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TreasuryAgent } from './agent/treasury.js'
import { createIndexer } from './evm/indexer.js'
import { validateToken, validateAmount, validateAddress, VALID_STRATEGIES } from './validation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

// ─── Agent Singleton ───
const agent = new TreasuryAgent()
const indexer = createIndexer()

// ─── Rate Limiters ───
const readLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false })
const writeLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false })
const txLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false })

// ─── Middleware ───
app.use(express.static(path.join(__dirname, '..', 'web', 'public')))
app.use(express.json())
app.set('views', path.join(__dirname, '..', 'web', 'views'))

// ─── Pages ───

app.get('/', (req, res) => {
  res.sendFile(path.join(app.get('views'), 'index.html'))
})

// ─── API: Read ───

app.get('/api/health', (req, res) => {
  const snap = agent.getSnapshot()
  res.json({
    status: 'ok',
    version: '0.1.0',
    uptime: Math.round(process.uptime()),
    wallet: !!snap.address,
    modules: {
      wallet: true,
      aave: !!agent.aave,
      swap: !!agent.swap,
      llm: !!agent.llm,
      creditScore: true
    },
    agent: { active: snap.active, paused: snap.paused, cycle: snap.cycle },
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
  })
})

app.get('/api/status', readLimiter, async (req, res) => {
  const snap = agent.getSnapshot()
  let chainInfo = { name: 'Unknown', chainId: 0, type: 'testnet' }
  try {
    const network = await agent.wallet?.provider?.getNetwork()
    const cid = Number(network?.chainId || 0)
    const { getChainById } = await import('./evm/chains.js')
    const cfg = getChainById(cid)
    if (cfg) { chainInfo = { name: cfg.name, chainId: cid, type: cfg.type } }
    else { chainInfo = { name: network?.name || `Chain ${cid}`, chainId: cid, type: 'unknown' } }
  } catch {}
  res.json({
    name: 'DotAgent',
    version: '0.1.0',
    address: snap.address,
    active: snap.active,
    paused: snap.paused,
    cycle: snap.cycle,
    strategy: snap.strategy?.name || 'none',
    swapProvider: snap.swapProvider || 'uniswap',
    lendingPct: snap.lendingPct,
    uptime: process.uptime(),
    chain: chainInfo
  })
})

app.get('/api/portfolio', readLimiter, (req, res) => {
  const snap = agent.getSnapshot()
  res.json({
    balances: snap.balances,
    supplied: snap.supplied,
    aaveAccount: snap.aaveAccount,
    aaveAPYs: snap.aaveAPYs,
    portfolio: snap.portfolio,
    prices: snap.prices,
    lendingPct: snap.lendingPct
  })
})

app.get('/api/actions', readLimiter, (req, res) => {
  const snap = agent.getSnapshot()
  const limit = parseInt(req.query.limit) || 50
  res.json({
    actions: snap.recentActions.slice(-limit),
    errors: snap.recentErrors
  })
})

app.get('/api/snapshot', readLimiter, (req, res) => {
  res.json(agent.getSnapshot())
})

app.get('/api/reasoning', readLimiter, (req, res) => {
  const snap = agent.getSnapshot()
  res.json({
    trail: snap.reasoningTrail || [],
    nextCheck: snap.nextCheck,
    cycle: snap.cycle,
    llm: {
      enabled: snap.llm?.enabled,
      connected: snap.llm?.connected,
      lastReasoning: snap.llm?.lastDecision?.reasoning,
      market: snap.llm?.lastDecision?.market_assessment,
      risk: snap.llm?.lastDecision?.risk_level,
      nextSuggestion: snap.llm?.lastDecision?.next_check_suggestion
    }
  })
})

app.get('/api/modules', readLimiter, (req, res) => {
  const snap = agent.getSnapshot()
  res.json({
    total: 5,
    modules: [
      { id: 'wallet', name: 'EVM Wallet', active: true, detail: `ethers.js ${snap.address?.slice(0, 8)}...` },
      { id: 'lending', name: 'Aave V3', active: !!agent.aave, detail: agent.aave ? `Pool ${process.env.AAVE_POOL?.slice(0, 8)}...` : 'Not configured' },
      { id: 'swap', name: 'Uniswap V3', active: !!agent.swap, detail: snap.swapProvider || 'uniswap' },
      { id: 'credit', name: 'Credit Scoring', active: true, detail: '5-dimension on-chain scoring' },
      { id: 'reasoning', name: 'LLM Reasoning', active: snap.llm?.connected, detail: snap.llm?.connected ? 'Claude AI' : 'Not connected' }
    ]
  })
})

// ─── API: Control ───

app.post('/api/strategy', writeLimiter, (req, res) => {
  try {
    const { name, config } = req.body
    if (name && typeof name === 'string' && !VALID_STRATEGIES.includes(name.toUpperCase())) {
      return res.status(400).json({ error: `invalid strategy: ${name}. Valid: ${VALID_STRATEGIES.join(', ')}` })
    }
    agent.setStrategy(name || config)
    res.json({ ok: true, strategy: agent.strategy })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/api/start', writeLimiter, (req, res) => {
  const interval = Number(req.body.intervalMs) || 60_000
  if (interval < 10_000 || interval > 3_600_000) {
    return res.status(400).json({ error: 'intervalMs must be between 10000 and 3600000' })
  }
  agent.start(interval)
  res.json({ ok: true, active: true, intervalMs: interval })
})

app.post('/api/stop', writeLimiter, (req, res) => {
  agent.stop()
  res.json({ ok: true, active: false })
})

app.post('/api/pause', writeLimiter, (req, res) => {
  agent.paused ? agent.resume() : agent.pause()
  res.json({ ok: true, paused: agent.paused })
})

// ─── API: LLM Control ───

app.get('/api/llm', readLimiter, (req, res) => {
  const snap = agent.getSnapshot()
  res.json(snap.llm)
})

app.post('/api/llm/toggle', writeLimiter, (req, res) => {
  agent.llmEnabled = !agent.llmEnabled
  res.json({ ok: true, llmEnabled: agent.llmEnabled, connected: !!agent.llm })
})

app.post('/api/llm/reason', writeLimiter, async (req, res) => {
  try {
    if (!agent.llm) return res.status(400).json({ error: 'LLM not connected' })
    const instruction = req.body.instruction
    if (instruction && (typeof instruction !== 'string' || instruction.length > 2000)) {
      return res.status(400).json({ error: 'instruction must be a string (max 2000 chars)' })
    }
    const snapshot = agent.getSnapshot()
    const decision = await agent.llm.reason(snapshot, { userInstruction: instruction })
    agent._lastLlmDecision = decision
    res.json({ ok: true, decision })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── API: Natural Language Command ───

app.post('/api/command', txLimiter, async (req, res) => {
  const text = (req.body.text || '').trim()
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text is required' })
  if (text.length > 500) return res.status(400).json({ error: 'text too long (max 500 chars)' })

  const parsed = parseCommand(text)

  if (parsed) {
    try {
      const result = await executeAction(parsed)
      agent.log('nlp_command', `"${text}" -> ${parsed.action} ${parsed.token || ''} ${parsed.amount || ''}`, result)
      return res.json({ ok: true, parsed, result, source: 'pattern' })
    } catch (e) {
      return res.status(500).json({ ok: false, parsed, error: e.message })
    }
  }

  if (!agent.llm) {
    return res.status(400).json({ error: 'Command not recognized and LLM not connected. Try: "supply 50 USDT", "swap 100 USDT to WETH", "withdraw all DAI"' })
  }

  try {
    const snapshot = agent.getSnapshot()
    const decision = await agent.llm.reason(snapshot, {
      userInstruction: `The user typed this natural language command: "${text}". Parse their intent and respond with the appropriate action. If they want to execute something, include it as a high-confidence action. If they're asking a question, use the answer field.`
    })
    agent._lastLlmDecision = decision

    const executed = []
    for (const action of (decision.actions || []).filter(a => a.confidence >= 0.7)) {
      try {
        const result = await executeAction(action)
        agent.log('nlp_command', `"${text}" -> ${action.type} ${action.token || ''} ${action.amount || ''}`, result)
        executed.push({ action, result })
      } catch (e) {
        executed.push({ action, error: e.message })
      }
    }

    await agent.refresh()
    return res.json({ ok: true, decision, executed, source: 'llm' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

function parseCommand (text) {
  const t = text.toLowerCase().trim()
  const tokens = ['ETH', 'WETH', 'USDT', 'USDC', 'DAI']
  const findToken = s => tokens.find(tk => s.includes(tk.toLowerCase())) || null
  const findAmount = s => {
    if (/\ball\b/.test(s)) return 'max'
    const m = s.match(/(\d+(?:\.\d+)?)/)
    return m ? parseFloat(m[1]) : null
  }

  if (/^(supply|deposit|lend)\s/.test(t)) {
    const amount = findAmount(t)
    const token = findToken(t)
    if (amount && token) return { action: 'supply', token, amount }
  }

  if (/^(withdraw|remove)\s/.test(t)) {
    const amount = findAmount(t)
    const token = findToken(t)
    if (amount && token) return { action: 'withdraw', token, amount }
  }

  if (/^(swap|convert|exchange|trade)\s/.test(t)) {
    const amount = findAmount(t)
    const parts = t.split(/\s+(?:to|for|into|->)\s+/)
    const tokenIn = findToken(parts[0])
    const tokenOut = parts[1] ? findToken(parts[1]) : null
    if (amount && tokenIn && tokenOut) return { action: 'swap', tokenIn, tokenOut, amount }
  }

  if (/^(set\s+)?strategy\s/.test(t) || /^(use|switch\s+to)\s/.test(t)) {
    const strategies = { conservative: 'CONSERVATIVE', balanced: 'BALANCED', aggressive: 'AGGRESSIVE', 'usdt yield': 'USDT_YIELD', 'tether diversified': 'TETHER_DIVERSIFIED' }
    for (const [key, val] of Object.entries(strategies)) {
      if (t.includes(key)) return { action: 'strategy', name: val }
    }
  }

  if (/^start\b/.test(t)) return { action: 'start' }
  if (/^stop\b/.test(t)) return { action: 'stop' }
  if (/^pause\b/.test(t)) return { action: 'pause' }
  if (/^refresh\b/.test(t)) return { action: 'refresh' }

  return null
}

async function executeAction (action) {
  const type = action.action || action.type
  switch (type) {
    case 'supply':
    case 'lending_supply': {
      const token = action.token
      const amount = action.amount === 'max' ? Infinity : parseFloat(action.amount)
      return agent.aave.supply(token, amount)
    }
    case 'withdraw':
    case 'lending_withdraw': {
      const token = action.token
      const amount = action.amount === 'max' ? Infinity : parseFloat(action.amount)
      return agent.aave.withdraw(token, amount)
    }
    case 'swap': {
      const tokenIn = action.tokenIn || action.token
      const tokenOut = action.tokenOut
      return agent.swap.sell(tokenIn, tokenOut, parseFloat(action.amount), 2)
    }
    case 'strategy': {
      agent.setStrategy(action.name)
      return { strategy: agent.strategy }
    }
    case 'start': {
      agent.start(60_000)
      return { active: true }
    }
    case 'stop': {
      agent.stop()
      return { active: false }
    }
    case 'pause': {
      agent.paused ? agent.resume() : agent.pause()
      return { paused: agent.paused }
    }
    case 'transfer': {
      return agent.wallet.transfer(action.token, action.to, action.amount === 'max' ? Infinity : parseFloat(action.amount))
    }
    case 'refresh': {
      await agent.refresh()
      return { balances: agent.balances }
    }
    default:
      throw new Error(`Unknown action: ${type}`)
  }
}

// ─── API: Conditional Rules ───

app.get('/api/rules', readLimiter, (req, res) => {
  res.json({ rules: agent.getRules() })
})

app.post('/api/rules', writeLimiter, async (req, res) => {
  const { text, rule: directRule } = req.body

  if (directRule) {
    try {
      const added = agent.addRule(directRule)
      return res.json({ ok: true, rule: added, source: 'direct' })
    } catch (e) {
      return res.status(400).json({ error: e.message })
    }
  }

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Provide "text" (natural language) or "rule" (structured)' })
  }
  if (text.length > 1000) return res.status(400).json({ error: 'text too long (max 1000 chars)' })

  if (!agent.llm) {
    return res.status(400).json({ error: 'LLM not connected — cannot parse natural language rules.' })
  }

  try {
    const snapshot = agent.getSnapshot()
    const parsed = await agent.llm.parseRule(text, snapshot)

    if (parsed.confidence < 0.5) {
      return res.json({ ok: false, parsed, error: 'Low confidence — please rephrase' })
    }

    const added = agent.addRule(parsed)
    agent.log('nlp_rule', `Rule created via NL: "${text}" -> "${parsed.description}"`, { id: added.id })
    return res.json({ ok: true, rule: added, parsed, source: 'llm' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

app.delete('/api/rules/:id', writeLimiter, (req, res) => {
  const removed = agent.removeRule(req.params.id)
  if (!removed) return res.status(404).json({ error: 'Rule not found' })
  res.json({ ok: true })
})

app.post('/api/cycle', writeLimiter, async (req, res) => {
  try {
    await agent.cycle()
    res.json({ ok: true, snapshot: agent.getSnapshot() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/refresh', writeLimiter, async (req, res) => {
  try {
    await agent.refresh()
    const snap = agent.getSnapshot()
    res.json({
      ok: true,
      balances: snap.balances,
      supplied: snap.supplied,
      portfolio: snap.portfolio
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── API: Direct Actions ───

app.post('/api/supply', txLimiter, async (req, res) => {
  try {
    const { token, amount } = req.body
    let err = validateToken(token)
    if (err) return res.status(400).json({ error: err })
    err = validateAmount(amount)
    if (err) return res.status(400).json({ error: err })
    const result = await agent.aave.supply(token, parseFloat(amount))
    agent.log('manual_supply', `Manual supply ${amount} ${token}`, result)
    await agent.refresh()
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/withdraw', txLimiter, async (req, res) => {
  try {
    const { token, amount } = req.body
    let err = validateToken(token)
    if (err) return res.status(400).json({ error: err })
    err = validateAmount(amount)
    if (err) return res.status(400).json({ error: err })
    const amt = amount === 'max' ? Infinity : parseFloat(amount)
    const result = await agent.aave.withdraw(token, amt)
    agent.log('manual_withdraw', `Manual withdraw ${amount} ${token}`, result)
    await agent.refresh()
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── API: Swap ───

app.get('/api/swap/pairs', readLimiter, (req, res) => {
  res.json({
    pairs: agent.swapPairs,
    provider: agent.swapProvider,
    note: agent.swapPairs.length === 0
      ? 'No liquidity pools available on this network.'
      : undefined
  })
})

app.post('/api/swap/quote', writeLimiter, async (req, res) => {
  try {
    const { tokenIn, tokenOut, amount, side } = req.body
    let err = validateToken(tokenIn)
    if (err) return res.status(400).json({ error: `tokenIn: ${err}` })
    err = validateToken(tokenOut)
    if (err) return res.status(400).json({ error: `tokenOut: ${err}` })
    err = validateAmount(amount)
    if (err) return res.status(400).json({ error: err })
    if (side && !['buy', 'sell'].includes(side)) return res.status(400).json({ error: 'side must be buy or sell' })
    const quote = await agent.swap.quote(tokenIn, tokenOut, parseFloat(amount), side || 'sell')
    res.json({ ok: true, ...quote })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/swap/execute', txLimiter, async (req, res) => {
  try {
    const { tokenIn, tokenOut, amount, slippage } = req.body
    let err = validateToken(tokenIn)
    if (err) return res.status(400).json({ error: `tokenIn: ${err}` })
    err = validateToken(tokenOut)
    if (err) return res.status(400).json({ error: `tokenOut: ${err}` })
    err = validateAmount(amount)
    if (err) return res.status(400).json({ error: err })
    const slip = Number(slippage) || 2
    if (slip < 0.01 || slip > 50) return res.status(400).json({ error: 'slippage must be 0.01-50%' })
    const result = await agent.swap.sell(tokenIn, tokenOut, parseFloat(amount), slip)
    agent.log('manual_swap', `Manual swap ${amount} ${tokenIn} -> ${result.amountOut} ${tokenOut}`, result)
    await agent.refresh()
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── API: Credit Scoring ───

app.get('/api/credit-score', readLimiter, async (req, res) => {
  try {
    const address = req.query.address || agent.wallet?.address
    if (!address) return res.status(400).json({ error: 'No address provided' })
    const addrErr = validateAddress(address)
    if (addrErr) return res.status(400).json({ error: addrErr })

    const { CreditScorer } = await import('./evm/credit-score.js')
    const scorer = new CreditScorer({
      provider: agent.wallet?.provider,
      poolAddress: process.env.AAVE_POOL,
      tokens: agent.wallet?.tokens || {}
    })
    const result = await scorer.score(address)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/credit-score/assess', txLimiter, async (req, res) => {
  try {
    const { borrower, amount, token } = req.body
    if (!borrower) return res.status(400).json({ error: 'borrower address required' })
    const addrErr2 = validateAddress(borrower)
    if (addrErr2) return res.status(400).json({ error: addrErr2 })

    const { CreditScorer } = await import('./evm/credit-score.js')
    const scorer = new CreditScorer({
      provider: agent.wallet?.provider,
      poolAddress: process.env.AAVE_POOL,
      tokens: agent.wallet?.tokens || {}
    })
    const credit = await scorer.score(borrower)

    const requestedUSD = parseFloat(amount) || 0
    const approved = requestedUSD <= credit.maxLoanUSD
    const decision = {
      ...credit,
      loanRequest: { amount: requestedUSD, token: token || 'USDT' },
      approved,
      reason: approved
        ? `Approved: score ${credit.score}/100, max loan $${credit.maxLoanUSD}, requested $${requestedUSD}`
        : `Denied: score ${credit.score}/100, max loan $${credit.maxLoanUSD}, requested $${requestedUSD} exceeds limit`,
      terms: approved ? {
        apr: credit.suggestedAPR,
        maxDuration: credit.score >= 60 ? '30 days' : '14 days',
        collateralRequired: credit.score >= 80 ? 'none' : credit.score >= 60 ? '120%' : credit.score >= 40 ? '150%' : '200%'
      } : null
    }

    agent.log('credit', `Credit assessment: ${borrower.slice(0, 10)}... -> score ${credit.score}, ${approved ? 'APPROVED' : 'DENIED'} $${requestedUSD}`)
    res.json(decision)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── API: Transaction History ───

app.get('/api/history', readLimiter, async (req, res) => {
  if (!indexer) return res.json({ enabled: false, transfers: [] })
  try {
    const address = agent.wallet?.address
    if (!address) return res.status(400).json({ error: 'Wallet not initialized' })
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)
    const transfers = await indexer.getTransfers(address, {
      limit,
      tokenAddress: req.query.token || undefined
    })
    res.json({ enabled: true, transfers })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── API: Agent Skills ───

app.get('/api/skills', readLimiter, (req, res) => {
  const snap = agent.getSnapshot()
  res.json({
    name: 'dotagent',
    version: '0.1.0',
    description: 'Autonomous AI-Powered DeFi Agent for Polkadot Hub',
    skills: [
      { id: 'wallet', name: 'EVM Wallet', status: 'active', capabilities: ['balance', 'transfer', 'sign', 'approve'] },
      { id: 'swap', name: 'DEX Swap', status: agent.swap ? 'active' : 'inactive', provider: snap.swapProvider, capabilities: ['quote', 'swap'] },
      { id: 'lending', name: 'Aave V3 Lending', status: agent.aave ? 'active' : 'inactive', capabilities: ['supply', 'withdraw', 'borrow', 'repay'] },
      { id: 'credit', name: 'Credit Scoring', status: 'active', capabilities: ['on_chain_scoring', 'loan_assessment', 'risk_rating'] },
      { id: 'reasoning', name: 'LLM Reasoning', status: snap.llm?.connected ? 'active' : 'inactive', capabilities: ['market_analysis', 'risk_assessment', 'strategy_optimization'] }
    ]
  })
})

// ─── Boot ───

async function boot () {
  try {
    await agent.init()
    console.log(`[dotagent] Wallet: ${agent.wallet.address}`)
    console.log(`[dotagent] Balances:`, agent.balances)
    console.log(`[dotagent] Aave supplied:`, agent.supplied)

    agent.setStrategy('BALANCED')

    app.listen(PORT, () => {
      console.log(`[dotagent] Dashboard: http://localhost:${PORT}`)
    })
  } catch (e) {
    console.error('[dotagent] Boot failed:', e.message)
    process.exit(1)
  }
}

boot()

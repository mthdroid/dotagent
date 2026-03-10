#!/usr/bin/env node
// Quick validation test — run with: node scripts/test-validation.js

const BASE = process.env.DOTAGENT_URL || 'http://localhost:3000'
const G = '\x1b[32m', R = '\x1b[31m', D = '\x1b[2m', B = '\x1b[1m', X = '\x1b[0m'
let pass = 0, fail = 0

async function test (desc, method, path, body, expectStatus) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${BASE}${path}`, opts)
    const ok = res.status === expectStatus
    if (ok) { pass++; console.log(`  ${G}✓${X} ${desc} ${D}(${res.status})${X}`) }
    else { fail++; console.log(`  ${R}✗${X} ${desc} ${D}(expected ${expectStatus}, got ${res.status})${X}`) }
  } catch (e) {
    fail++; console.log(`  ${R}✗${X} ${desc} ${D}(${e.message})${X}`)
  }
}

console.log(`\n${B}DotAgent — Validation & Rate Limit Tests${X}\n`)

// Token validation
await test('Invalid token SHIB → 400', 'POST', '/api/swap/quote', { tokenIn: 'SHIB', tokenOut: 'USDC', amount: 100 }, 400)
await test('Valid token USDT → not 400', 'POST', '/api/swap/quote', { tokenIn: 'USDT', tokenOut: 'USDC', amount: 100 }, 200)

// Amount validation
await test('Negative amount → 400', 'POST', '/api/supply', { token: 'USDT', amount: -5 }, 400)
await test('Zero amount → 400', 'POST', '/api/supply', { token: 'USDT', amount: 0 }, 400)

// Strategy validation
await test('Invalid strategy YOLO → 400', 'POST', '/api/strategy', { name: 'YOLO' }, 400)
await test('Valid strategy USDT_YIELD → 200', 'POST', '/api/strategy', { name: 'USDT_YIELD' }, 200)
await test('Valid strategy CONSERVATIVE → 200', 'POST', '/api/strategy', { name: 'CONSERVATIVE' }, 200)

// Read endpoints (should work)
await test('GET /api/status → 200', 'GET', '/api/status', null, 200)
await test('GET /api/portfolio → 200', 'GET', '/api/portfolio', null, 200)
await test('GET /api/credit-score → 200', 'GET', '/api/credit-score', null, 200)

console.log(`\n${B}Results: ${G}${pass} passed${X}, ${fail ? R + fail + ' failed' : '0 failed'}${X}\n`)

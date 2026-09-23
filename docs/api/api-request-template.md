# API Request: <ID and name>

Use this as the body of a Linear issue titled `[Gap] REQ-0NN — <need>`, labelled with the semantic owner, and add it to the Notion index "Frontoffice — Deferred Backend Contract Gaps". Gap records are not kept in this repository.

- **Need / user outcome:**
- **Frontend consumer:** route, component, or server helper
- **Why existing contracts are insufficient:**
- **Backend contract lookup result:** `finance-backend/docs/api-contract.json`, then `docs/openapi.json`; include version/commit and matches checked
- **Semantic owner:** repository/team responsible for the meaning
- **Gap layer:** source / canonical-derived semantic / ML evidence / signal intent / realized simulation / experiment lineage / eligibility-activation / HTTP exposure / deployment-runtime / frontend consumption-state
- **Upstream evidence:** authoritative schema, methodology, lineage, or owner decision
- **Why HTTP exposure is the correct missing layer:** explain why the semantic already exists upstream and only transport is absent; otherwise route to the semantic owner
- **Proposed method and endpoint:** proposal only until approved
- **Minimum request fields:** names, types, required/optional, limits
- **Minimum response fields:** names, types, nullability, units, timestamps
- **Authentication/authorization:**
- **Errors:** statuses/codes, retryability, timeout and partial-data behavior
- **Caching/pagination/rate limits:**
- **Privacy and logging constraints:**
- **Priority:** critical / high / normal / low
- **Dependencies and owners:**
- **Compatibility/versioning:**
- **Approval state:** draft / frontend-reviewed / backend-reviewed / approved / implemented / verified / declined
- **Contract evidence:** backend schema, tests, example with synthetic values
- **Frontend fallback until available:**

No frontend derivation, third-party lookup, endpoint fan-out, approximate substitution, or “complete” graceful degradation is permitted without an explicit approved decision.

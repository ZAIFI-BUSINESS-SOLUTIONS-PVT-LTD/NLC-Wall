# Test Case Catalog — Live Sign Wall

Complete enumeration of every automated test case in the project, generated from the actual
test runners (`pytest --collect-only` and `vitest list`). Each entry is a single, independently
runnable test.

- **Backend (pytest):** 172 test cases across 10 files
- **Frontend (Vitest):** 65 test cases across 8 files
- **Total: 237 test cases**

_Generated 2026-06-13. See `TESTING.md` for how to run them._

---

## Backend — pytest (`backend/tests/`)

### `test_api_admin_config.py` — 15 cases

_Admin config endpoints — display theme, multilingual pledge, chief-guest config (validation + DB persistence)._

**Display Theme**

1. Default is sky
2. Set valid theme
3. Invalid theme rejected 400
4. All seven themes accepted

**Pledge Config**

5. Get returns defaults
6. Post updates and persists
7. Duration clamped high
8. Duration clamped low
9. Text truncated to 4000
10. Empty languages allowed

**Chief Guest Config**

11. Get returns defaults
12. Enable forever
13. Until datetime with timestamp
14. Invalid mode rejected 422
15. Config persists across get

### `test_api_admin_db.py` — 19 cases

_Admin signature management — clears, paginated listing, edit, chief-guest toggle, delete, image download, save-to-disk._

**Clear Endpoints**

16. Clear audience keeps chief guests
17. Clear chief guests keeps audience

**Db Listing**

18. Empty
19. Listing newest first with total
20. Pagination

**Update Name**

21. Update success
22. Update invalid name 422
23. Update missing 404

**Chief Guest Toggle**

24. Mark and unmark
25. Missing 404

**Delete**

26. Delete success
27. Delete missing 404

**Image Download**

28. Download png
29. No signature 404
30. Missing id 404
31. Malformed base64 returns 500

**Save Images**

32. Resaves missing files
33. Nothing to save when already on disk
34. Signatureless entries not counted

### `test_api_health.py` — 3 cases

_GET /health — total vs audience vs chief-guest counts._

**Health**

35. Health shape when empty
36. Counts audience only by default
37. Chief guest split

### `test_api_submit.py` — 17 cases

_POST /submit and GET /signatures — happy paths and every moderation/validation rejection code._

**Submit Happy Path**

38. Submit returns id and timestamp
39. Submit stores signature
40. Submit with image writes png to disk
41. Submit without signature is allowed
42. Name is trimmed server side
43. Tamil name round trips

**Submit Validation**

44. Empty name unprocessable
45. Whitespace name unprocessable
46. Name too long unprocessable
47. Missing name unprocessable
48. Signature too large unprocessable

**Submit Moderation**

49. Profane name rejected 400
50. Duplicate name rejected 409
51. Rate limit returns 429

**Get Signatures**

52. Empty initially
53. Returns full records with base64
54. Order is insertion order

### `test_database.py` — 23 cases

_SQLite layer — schema init/migration, config store, signature CRUD, ordering, metadata, pagination, selective clears._

**Init Db**

55. Init db is idempotent
56. Signatures table has is chief guest column

**Config Store**

57. Missing key returns none
58. Set then get
59. Set overwrites existing

**Add And Get**

60. Add and fetch full record
61. Get missing returns none
62. Add same id replaces

**Load Order**

63. Load returns chronological ascending
64. Load restores chief guest flag

**Meta Listing**

65. Meta is newest first
66. Meta excludes base64 payload
67. Meta has sig false for none and empty
68. Meta pagination skip and limit
69. Meta chief guest flag is bool

**Update Delete**

70. Update name existing
71. Update name missing
72. Set chief guest persists as bool
73. Set chief guest missing
74. Delete existing and missing

**Clear Helpers**

75. Clear audience only
76. Clear chief guests only
77. Clear all

### `test_integration.py` — 6 cases

_End-to-end operator flows and crash recovery (store rebuilt from SQLite on restart)._

**Event Flow**

78. Audience and chief guest lifecycle
79. Edit name then download image
80. Same name allowed after duplicate window
81. Theme and pledge survive into new connection

**Persistence Reload**

82. Store rebuilt from db on restart
83. Reload respects max cap

### `test_models.py` — 33 cases

_Pydantic models — request/response validation, trimming, length & size limits, enum checks, clamping._

**Submit Request Name**

84. Valid name passes
85. Name is trimmed
86. Empty name rejected
87. Whitespace only name rejected
88. Name at max length 60 passes
89. Name over 60 rejected
90. Name trimmed then measured for length
91. Unicode tamil name allowed
92. Missing name field rejected

**Submit Request Signature**

93. Signature none ok
94. Signature small ok
95. Signature at limit ok
96. Signature over limit rejected

**Signature**

97. Defaults
98. Model dump round trip

**Simple Models**

99. Submit response
100. Health response defaults
101. Theme body
102. Chief guest mark body

**Update Name Body**

103. Valid
104. Empty rejected
105. Too long rejected

**Pledge Config Body**

106. Defaults
107. Text is trimmed
108. Text truncated to 4000
109. Duration clamped low
110. Duration clamped high
111. Duration within range untouched
112. Duration negative clamped to min

**Chief Guest Config Body**

113. Forever mode
114. Until datetime mode
115. Invalid mode rejected
116. Enabled required

### `test_moderation.py` — 23 cases

_Moderation engine — per-IP rate limiting, profanity blocklist, duplicate-name window (fake-clock driven)._

**Profanity**

117. Clean name passes
118. Tamil name passes
119. Each blocklisted word detected[asshole]
120. Each blocklisted word detected[bastard]
121. Each blocklisted word detected[bitch]
122. Each blocklisted word detected[crap]
123. Each blocklisted word detected[damn]
124. Each blocklisted word detected[fuck]
125. Each blocklisted word detected[shit]
126. Detection is case insensitive
127. Detection within sentence
128. Known substring false positive is documented

**Rate Limit**

129. Allows up to the limit
130. Blocks after limit
131. Limit is per ip
132. Window expiry frees the quota
133. Partial window slide

**Duplicate**

134. First submission not duplicate
135. Immediate repeat is duplicate
136. Different name not duplicate
137. Match is case insensitive and trimmed
138. Duplicate expires after window
139. Same name second person allowed after window

### `test_storage.py` — 21 cases

_In-memory store + 500-item FIFO cap, audience/chief-guest counting, clears, and PNG disk persistence._

**Add And Count**

140. Add increases count
141. Add persists to database
142. Get all returns copy not internal list
143. Get all preserves insertion order

**Count Audience**

144. Counts only non chief guests
145. Empty store counts zero

**Max Signatures Cap**

146. Memory capped at max
147. Oldest is evicted from memory
148. Database keeps all rows beyond cap

**Mutations**

149. Remove existing returns true
150. Remove missing returns false
151. Update name changes memory and db
152. Update name missing returns false
153. Set chief guest toggle
154. Set chief guest missing returns false

**Clearing**

155. Clear audience keeps chief guests
156. Clear chief guests keeps audience
157. Clear removes everything

**Disk Save**

158. Signature written to dated folder
159. No signature writes no file
160. Malformed signature does not crash add

### `test_websocket.py` — 12 cases

_/ws channel — connect handshake and every server broadcast, including fan-out to multiple clients._

**Handshake**

161. Init frames in order
162. Init carries existing signatures
163. Handshake includes current theme and configs

**Signature Broadcasts**

164. New signature broadcast
165. Remove signature broadcast
166. Update signature broadcast on cg toggle

**Clear Broadcasts**

167. Clear audience broadcast
168. Clear chief guests broadcast

**Config Broadcasts**

169. Display theme broadcast
170. Pledge config broadcast
171. Cg config broadcast

**Multiple Clients**

172. Broadcast reaches all connected clients

---

## Frontend — Vitest (`frontend/src/__tests__/`)

### `AdminPage.test.tsx` — 6 cases

_Admin panel — header, live stats, empty DB state, theme POST, clear-wall, all theme buttons._

**AdminPage**

1. renders the admin header
2. shows the live stats fetched from /health
3. renders the empty database state
4. posts a new display theme when a theme button is clicked
5. clears the audience wall after confirmation
6. exposes all seven display-wall theme options

### `DisplayPage.test.tsx` — 6 cases

_Display wall page — HUD, chief-guest banner, pledge panel, WS event reducer (children mocked)._

**DisplayPage**

7. renders the wall HUD
8. does not show the Chief Guest banner when there are none
9. shows the Chief Guest banner with names from the init payload
10. renders the pledge panel after a pledge_config event (Tamil first)
11. removes a chief guest from the banner when a clear_chief_guests event arrives
12. adds a newly broadcast audience signature to state

### `InputPage.test.tsx` — 5 cases

_Visitor input page — header, submit gating, success overlay, error surfacing, name trimming._

**InputPage**

13. renders the event header and submit button
14. disables submit until a name is entered
15. posts the name and shows the success ceremony overlay
16. surfaces the server error detail on a rejected submission
17. trims whitespace from the name before sending

### `NameInput.test.tsx` — 5 cases

_Name input component — label, controlled value, onChange, 60-char cap, disabled._

**NameInput**

18. renders the label, optional hint and placeholder
19. shows the controlled value
20. calls onChange when the user types
21. caps input at 60 characters
22. can be disabled

### `SignatureCanvas.test.tsx` — 4 cases

_Signature canvas — render, hidden actions until drawn, reset-token clears export._

**SignatureCanvas**

23. renders the signature label and optional hint
24. renders a canvas element
25. hides the Undo/Clear buttons until something is drawn
26. clears and reports an empty export when the reset token advances

### `animation.test.ts` — 15 cases

_Canvas physics in utils/animation.ts — palette hashing, spawn, glow, depth recession, containment, rotation clamp, separation._

**CARD_PALETTES**

27. has 8 palette entries
28. each entry exposes the colours the renderer needs

**createItem**

29. assigns a palette index within range
30. derives the palette deterministically from the signature id
31. spawns inside the canvas with the documented margins
32. starts large, fully opaque and glowing for the entry animation
33. gives a bounded initial velocity and rotation

**tickItems – glow**

34. only the newest (last) item glows

**tickItems – depth recession**

35. keeps the newest 10 fully opaque and fades older ones

**tickItems – wall containment**

36. clamps an item that has drifted past the right/bottom edges back inside
37. clamps an item that has drifted past the left/top edges back inside

**tickItems – rotation clamp**

38. never lets a card exceed +60° and reverses its spin
39. never lets a card go below -60° and reverses its spin

**tickItems – separation**

40. pushes two overlapping cards apart

**tickItems – ageing**

41. advances age and entry progress over time

### `themes.test.ts` — 17 cases

_All 7 display themes in utils/themes.ts — config shape, palettes, particle counts._

**THEME_CONFIGS**

42. defines all seven themes
43. 'sky' has a well-formed config
44. 'space' has a well-formed config
45. 'aurora' has a well-formed config
46. 'ocean' has a well-formed config
47. 'neon' has a well-formed config
48. 'forest' has a well-formed config
49. 'sunset' has a well-formed config
50. sky and space delegate their particles (clouds/stars handled elsewhere)
51. 'aurora' seeds 70 particles
52. 'ocean' seeds 50 particles
53. 'neon' seeds 30 particles
54. 'forest' seeds 53 particles
55. 'sunset' seeds 35 particles
56. themes with explicit palettes expose 8 colours
57. sky and space fall back to the default palette (null)
58. generated particles carry the fields the renderer reads

### `useWebSocket.test.ts` — 7 cases

_Reconnecting WebSocket hook — URL, frame parsing, malformed-frame tolerance, reconnect/backoff, unmount, error._

**useWebSocket**

59. opens a connection to the /ws endpoint
60. parses incoming frames and forwards them to the handler
61. ignores malformed frames without throwing
62. forwards a new_signature frame with its payload
63. reconnects after the socket closes
64. closes the socket and stops reconnecting on unmount
65. closes the socket on error


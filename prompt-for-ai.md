# Korean Grammar Content Generation Prompt

## Context

You are writing rich grammar explanation content for a Korean language learning app targeting TOPIK Level 1-2 learners. The content is stored in a JSON file (`grammar-details.json`) where each entry matches an existing grammar ID from the app's database.

---

## Output Format

Produce a **single valid JSON array**. Each element must follow this exact schema:

```json
{
  "id": <number>,
  "explanation": "<2-4 sentences of learner-friendly English. Focus on WHEN and WHY to use this grammar, not just dictionary definitions.>",
  "rules": [
    {
      "title": "<Conjugation/form rule>",
      "description": "<When this rule applies>",
      "examples": [
        {
          "korean": "<base word/stem>",
          "breakdown": "<stem + grammar ending>",
          "english": "<result with English meaning in context>"
        }
      ]
    }
  ],
  "notes": [
    {
      "icon": "check",
      "title": "<title>",
      "text": "<positive usage note or key insight>"
    },
    {
      "icon": "group",
      "title": "<title>",
      "text": "<nuance, comparison with similar grammar, or usage context>"
    },
    {
      "icon": "close",
      "title": "<title>",
      "text": "<common mistake or what NOT to do>"
    }
  ],
  "exceptions": [
    {
      "name": "<name>",
      "description": "<description>",
      "example": "<korean sentence>"
    }
  ]
}
```

### Notes on the schema

- **`explanation`**: Start with a clear 1-sentence definition, then 1-2 sentences explaining when a learner would actually use this grammar. Think "when do I reach for this pattern in conversation?"
- **`rules`**: Include 1-3 rules covering different conjugation patterns or uses. Each rule needs 2-3 examples showing **Korean → breakdown → English result**.
  - `korean`: the base word or stem being conjugated
  - `breakdown`: how the grammar attaches (e.g., `작 + 은`)
  - `english`: the full result with meaning in context (e.g., `작은 — small (as in 'a small book')`)
- **`notes`**: Use 2-4 notes. Available icons: `check`, `group`, `close`, `warning`, `info`. Make notes practical — "when do I use this?" focus.
  - `check` = key insight, confirmation, or main usage
  - `group` = nuance, comparison with similar grammar, social context
  - `close` = common mistake, what NOT to do, trap for learners
  - `warning` = subtle danger or exception to watch for
  - `info` = extra background, etymology, or formal vs casual distinction
- **`exceptions`**: Only include if there are genuine grammatical irregularities. If none, use empty array `[]`.
- **Tone**: Friendly but precise, like a good Korean tutor explaining to an English speaker. Avoid overly academic jargon. Use contractions and conversational English.

---

## Example Entry

```json
{
  "id": 40,
  "explanation": "이/가 is the subject particle. It marks WHO or WHAT is doing the action or possessing the property in a sentence. Use 이 after consonant-ending nouns, 가 after vowel-ending nouns. If you're not sure whether to use 은/는 or 이/가, ask: is this word the doer/haver of something? If yes, use 이/가.",
  "rules": [
    {
      "title": "Noun + consonant ending → + 이",
      "description": "Attach 이 when the noun ends in a consonant (받침).",
      "examples": [
        {
          "korean": "책",
          "breakdown": "책 + 이",
          "english": "책이 — The book [does/is something]"
        },
        {
          "korean": "학생",
          "breakdown": "학생 + 이",
          "english": "학생이 공부해요 — The student studies"
        }
      ]
    },
    {
      "title": "Noun + vowel ending → + 가",
      "description": "Attach 가 when the noun ends in a vowel (no 받침).",
      "examples": [
        {
          "korean": "의자",
          "breakdown": "의자 + 가",
          "english": "의자가 커요 — The chair is big"
        },
        {
          "korean": "사과",
          "breakdown": "사과 + 가",
          "english": "사과가 맛있어요 — The apple is delicious"
        }
      ]
    }
  ],
  "notes": [
    {
      "icon": "check",
      "title": "New information",
      "text": "이/가 often introduces new information into the conversation. When you first mention something, use 이/가. Once it's established as the topic, switch to 은/는."
    },
    {
      "icon": "group",
      "title": "Existence and possession",
      "text": "이/가 is required for 있다/없다/많다/적다: 책이 있어요 (There is a book / I have a book). You cannot say 책은 있어요 in standard Korean."
    },
    {
      "icon": "close",
      "title": "Don't double-mark",
      "text": "A noun cannot have both 은/는 and 이/가. Choose one: 책은 or 책이, never 책은이."
    }
  ],
  "exceptions": [
    {
      "name": "누가",
      "description": "누구 (who) + 가 contracts to 누가. This is the only form — you never say 누구가.",
      "example": "누가 왔어요? (Who came?)"
    }
  ]
}
```

---

## Grammar Points to Write

Process them **in ID order** and include **ALL** items listed below. Do not skip any IDs.

### Connectives & Clauses (IDs 76-89)

| ID | Grammar | Meaning |
|----|---------|---------|
| 76 | A/V-고 | And (sequence) |
| 77 | A/V-아/어서 | Because / and then (causal/sequential) |
| 78 | A/V-지만 | But / although |
| 79 | A/V-는데 / -(으)ㄴ/는데 | But / and / background info |
| 80 | A/V-(으)면 | If / when |
| 81 | A/V-(으)니까 / -(으)니 | Because / since |
| 82 | A/V-거나 | Or |
| 83 | A/V-(으)면서 / -(으)며 | While (simultaneous) |
| 84 | A/V-아/어도 | Even if / even though |
| 85 | V-(으)ㄴ 후에 / -고 나서 | After |
| 86 | V-기 전에 | Before |
| 87 | V-자마자 / -(으)ㄴ/는 대로 | As soon as |
| 88 | V-는 동안 / -(으)ㄹ 때 | During / while / when |
| 89 | A/V-(으)ㄴ/는/(으)ㄹ 때 | When |

### Desire, Ability, Permission & Necessity (IDs 90-102)

| ID | Grammar | Meaning |
|----|---------|---------|
| 90 | V-고 싶다 | Want to (1st person) |
| 91 | V-고 싶어하다 | Want to (3rd person) |
| 92 | A/V-아/어 보다 | Try doing |
| 93 | V-(으)ㄹ 수 있다/없다 | Can / cannot |
| 94 | V-(으)ㄹ 줄 알다/모르다 | Know how to / don't know how to |
| 95 | V-(으)ㄹ 수밖에 없다 | Have no choice but to |
| 96 | A/V-아/어도 되다 | It's okay to / may |
| 97 | A/V-(으)면 안 되다 | Must not |
| 98 | A/V-아/어야 되다/하다/겠다 | Must / have to / should |
| 99 | V-(으)ㄹ까 하다 / -(으)ㄹ까 싶다 | I'm thinking of / considering |
| 100 | A/V-(으)면 좋겠다 / -(으)면 좋다 | I wish / it would be nice if |
| 101 | V-는 게 좋다 / V-는 게 낫다 | It's good to / you'd better |
| 102 | V-(으)ㄹ 필요가 있다/없다 | Need to / don't need to |

### Giving & Receiving (IDs 103-108)

| ID | Grammar | Meaning |
|----|---------|---------|
| 103 | V-아/어 주다 | Do for someone |
| 104 | V-아/어 드리다 | Do for someone (honorific) |
| 105 | V-아/어 주시다 | Do for me (honorific) |
| 106 | V-아/어 받다 | Receive (doing for me) |
| 107 | V-아/어 드리다 / 올리다 | Give (humble) |
| 108 | V-아/어 주세요 / -(으)ㄹ래요? | Please do for me |

### Intention & Purpose (IDs 109-116)

| ID | Grammar | Meaning |
|----|---------|---------|
| 109 | V-(으)려고 | In order to / intending to |
| 110 | V-(으)려고 하다 | Intend to / plan to |
| 111 | V-(으)려면 | If one intends to |
| 112 | V-(으)러 | In order to (go/come to do) |
| 113 | V-기 위해서 | In order to (formal) |
| 114 | V-도록 | So that / to the extent |
| 115 | V-게 | So that (causative/result) |
| 116 | V-기로 하다 / -기로 되다 | Decide to / it is decided that |

### Nominalization & Modifiers (IDs 117-123)

| ID | Grammar | Meaning |
|----|---------|---------|
| 117 | V-는 것 / -(으)ㄴ 것 / -(으)ㄹ 것 | Noun clause (-ing / fact / thing) |
| 118 | V-는 것 같다 / -(으)ㄴ 것 같다 / -(으)ㄹ 것 같다 | Seems like / I think |
| 119 | A/V-(으)ㄴ/는/(으)ㄹ | Modifier (past/present/future) |
| 120 | V-는 중(이다) | In the middle of |
| 121 | V-기 / -ㅁ/음 | Nominalizer (formal) |
| 122 | A/V-던 / -았/었/였던 | Modifier (past habitual/recollection) |
| 123 | V-는 사람/것/데 | Modifying nouns |

### Experience, Time & State (IDs 124-136)

| ID | Grammar | Meaning |
|----|---------|---------|
| 124 | V-(으)ㄴ 적이 있다/없다 | Have/haven't experienced |
| 125 | V-(으)ㄴ 지 (시간) 되다 | It's been (time) since |
| 126 | V-(으)ㄴ/는지 알다/모르다 | Know/don't know whether |
| 127 | A/V-아/여 있다 | State (resultative / ongoing state) |
| 128 | A/V-(으)ㄹ 때 | When |
| 129 | V-기 시작하다 | Begin to |
| 130 | V-게 되다 | Become / end up |
| 131 | A/V-아/어지다 | Become (change of state) |
| 132 | A/V-아/여 보이다 | Look / seem |
| 133 | A/V-(으)ㄴ/는/(으)ㄹ 줄 알다/모르다 | Know/don't know that |
| 134 | V-(으)ㄹ 줄 알았다/몰랐다 | Thought/didn't think that |
| 135 | V-기도 하다 | Sometimes do / also do |
| 136 | V-기 쉽다 / -기 어렵다 | Easy to / hard to |

### Exclamations, Suggestions & Questions (IDs 137-150)

| ID | Grammar | Meaning |
|----|---------|---------|
| 137 | A/V-네요 | Exclamation (realization) |
| 138 | A/V-군요 / -(는)구나 | Exclamation (discovery) |
| 139 | A/V-지요? / -죠? | Right? / isn't it? |
| 140 | A/V-(ㄴ/는)가(요)? / -(으)ㄴ/는지 | Plain question / indirect question |
| 141 | A/V-잖아(요) | You know... / after all |
| 142 | A/V-(ㄴ/는)다고(요)? | You mean...? / I see that... |
| 143 | A/V-거든(요) | You see / because (casual) |
| 144 | V-자 | Let's (casual) |
| 145 | V-(으)ㅂ시다 | Let's (formal) |
| 146 | V-(으)ㄹ까요? | Shall we? / I wonder |
| 147 | V-(으)ㄹ래요? / -(으)ㄹ래? | Do you want to? / Shall I? |
| 148 | A/V-아/어도 돼요? | Is it okay if...? |
| 149 | 누구/무엇/어디/언제/왜/어떻게/어느/몇 | Question words (grammar usage) |
| 150 | 아무-나 / 아무-도 / 누구-나 / 모든 | Anybody / nobody / everybody / every |

### Passive, Causative & Change (IDs 151-158)

| ID | Grammar | Meaning |
|----|---------|---------|
| 151 | V-아/어지다 | Passive / become |
| 152 | V-게 하다 / -게 되다 | Make / let / end up |
| 153 | V-이/히/리/기- | Passive/causative irregular stems |
| 154 | V-도록 하다 | Make sure that |
| 155 | V-시키다 | Causative (make someone do) |
| 156 | V-아/어 놓다/두다 | Do for later / keep |
| 157 | V-아/어 버리다 | Do completely / regretfully |
| 158 | V-아/어 오다/가다 | Go/come doing |

### Miscellaneous Beginner Patterns (IDs 159-190)

| ID | Grammar | Meaning |
|----|---------|---------|
| 159 | N-들 | Plural marker |
| 160 | A/V-(으)ㄹ 걸(요) | Probably would |
| 161 | A/V-(으)ㄹ 테니(까) | I will... so... |
| 162 | V-고 복면 | If you think about it |
| 163 | V-고 보니(까) | Having done, I realized |
| 164 | V-다가 | While doing, then |
| 165 | V-다가(는) | If you keep doing... |
| 166 | V-(ㄴ/는)다면 | If (supposition) |
| 167 | N-(이)라도 | Even if it is / at least |
| 168 | N-뿐(만 아니라) | Only / not only... but also (introduced) |
| 169 | N-조차 / N-마저 | Even (emphatic/negative) |
| 170 | N-대신(에) | Instead of |
| 171 | A/V-(으)ㄴ/는 데 (좋다/나쁘다) | Good/bad for |
| 172 | V-는 법이다 | It is natural to |
| 173 | V-는 척하다 / -(으)ㄴ 척하다 | Pretend to |
| 174 | V-는 통에 / -(으)ㄴ 탓에 | Because of (disruption/negative) |
| 175 | V-는 덕분에 | Thanks to (positive) |
| 176 | V-(으)ㄴ/는 걸 보니(까) | Judging from |
| 177 | V-(으)ㄴ 채(로) | While in a state of |
| 178 | V-곤 하다 | Often / tend to |
| 179 | V-(으)ㄹ 만하다 | Be worth doing |
| 180 | A/V-다시피 | As you know |
| 181 | A/V-(으)ㄴ/는/(으)ㄹ 셈이다 | Equivalent to / amount to |
| 182 | V-나 보다 / -(으)ㄴ가 보다 | Seems like / apparently |
| 183 | A/V-(으)ㄴ/는/(으)ㄹ 듯하다 | Seem as if |
| 184 | A/V-(으)ㄹ 리가 없다 | No way / impossible |
| 185 | A/V-(으)ㄹ 테니(까) | I will... so... |
| 186 | A/V-(으)ㄹ 텐데(요) | I would... but |
| 187 | V-(으)ㄹ 걸 그랬다 | I should have |
| 188 | V-기 마련이다 | Bound to |
| 189 | V-기 십상이다 | Very likely to |
| 190 | V-(으)ㄹ 뻔하다 | Almost / nearly |

---

## Important Instructions

1. **Output ONLY the raw JSON array.** Do not wrap it in markdown code blocks (no ```json). Start with `[` and end with `]`.
2. Every object must have a unique `"id"` matching the ID in the table above.
3. Ensure the JSON is valid — no trailing commas after the last element in any array or object.
4. Write entries in ID order (ascending).
5. If a batch is too large, process by category and output one category at a time. But always include ALL items for that category.
6. For each entry, the `explanation` field should be a single string (not an array). Use sentence breaks within the string.
7. Make examples natural — things a beginner Korean learner would actually say or encounter.
8. When comparing similar grammar points (e.g., -지만 vs -는데), highlight the nuance in the notes section, not just in the explanation.

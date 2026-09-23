;; polls.clar
;; On-chain polls: anyone can create a poll with 2-3 options and a lifetime
;; measured in Stacks blocks; any principal may cast exactly one vote per poll
;; while it is open. Tallies live entirely on-chain and are readable by anyone.

(define-constant ERR_NOT_FOUND (err u100))
(define-constant ERR_ALREADY_VOTED (err u101))
(define-constant ERR_POLL_CLOSED (err u102))
(define-constant ERR_INVALID_OPTION (err u103))
(define-constant ERR_INVALID_INPUT (err u104))

(define-data-var poll-nonce uint u0)

(define-map polls
  uint
  {
    creator: principal,
    question: (string-ascii 280),
    option-1: (string-ascii 64),
    option-2: (string-ascii 64),
    option-3: (string-ascii 64),
    has-option-3: bool,
    votes-1: uint,
    votes-2: uint,
    votes-3: uint,
    created-at: uint,
    close-at: uint,
  }
)

(define-map has-voted
  { poll-id: uint, voter: principal }
  bool
)

;; --- read-only ---

(define-read-only (get-poll (poll-id uint))
  (map-get? polls poll-id)
)

(define-read-only (get-poll-count)
  (var-get poll-nonce)
)

(define-read-only (has-account-voted (poll-id uint) (voter principal))
  (default-to false (map-get? has-voted { poll-id: poll-id, voter: voter }))
)

(define-read-only (is-poll-open (poll-id uint))
  (match (map-get? polls poll-id)
    poll (ok (< stacks-block-height (get close-at poll)))
    ERR_NOT_FOUND
  )
)

;; --- public ---

(define-public (create-poll
    (question (string-ascii 280))
    (option-1 (string-ascii 64))
    (option-2 (string-ascii 64))
    (option-3 (string-ascii 64))
    (duration-blocks uint)
  )
  (let ((poll-id (var-get poll-nonce)))
    (asserts! (> (len question) u0) ERR_INVALID_INPUT)
    (asserts! (> (len option-1) u0) ERR_INVALID_INPUT)
    (asserts! (> (len option-2) u0) ERR_INVALID_INPUT)
    (asserts! (and (> duration-blocks u0) (<= duration-blocks u52560)) ERR_INVALID_INPUT)
    (map-set polls poll-id {
      creator: tx-sender,
      question: question,
      option-1: option-1,
      option-2: option-2,
      option-3: option-3,
      has-option-3: (> (len option-3) u0),
      votes-1: u0,
      votes-2: u0,
      votes-3: u0,
      created-at: stacks-block-height,
      close-at: (+ stacks-block-height duration-blocks),
    })
    (var-set poll-nonce (+ poll-id u1))
    (ok poll-id)
  )
)

(define-public (vote (poll-id uint) (option uint))
  (let ((poll (unwrap! (map-get? polls poll-id) ERR_NOT_FOUND)))
    (asserts! (< stacks-block-height (get close-at poll)) ERR_POLL_CLOSED)
    (asserts! (not (has-account-voted poll-id tx-sender)) ERR_ALREADY_VOTED)
    (asserts!
      (or
        (is-eq option u1)
        (is-eq option u2)
        (and (is-eq option u3) (get has-option-3 poll))
      )
      ERR_INVALID_OPTION
    )
    (map-set has-voted { poll-id: poll-id, voter: tx-sender } true)
    (map-set polls poll-id
      (if (is-eq option u1)
        (merge poll { votes-1: (+ (get votes-1 poll) u1) })
        (if (is-eq option u2)
          (merge poll { votes-2: (+ (get votes-2 poll) u1) })
          (merge poll { votes-3: (+ (get votes-3 poll) u1) })
        )
      )
    )
    (ok true)
  )
)

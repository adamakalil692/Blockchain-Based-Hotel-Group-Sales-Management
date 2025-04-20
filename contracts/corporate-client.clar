;; Corporate Client Contract
;; Manages negotiated rate agreements between hotels and corporate clients

(define-data-var admin principal tx-sender)

;; Map to store corporate rate agreements
(define-map rate-agreements
  { hotel-id: principal, client-id: principal }
  {
    rate: uint,
    start-date: uint,
    end-date: uint,
    active: bool
  }
)

;; Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Create a new rate agreement
(define-public (create-rate-agreement
  (hotel-id principal)
  (client-id principal)
  (rate uint)
  (start-date uint)
  (end-date uint))
  (begin
    (asserts! (or (is-eq tx-sender hotel-id) (is-admin)) (err u1))
    (asserts! (> end-date start-date) (err u2))
    (ok (map-set rate-agreements
      { hotel-id: hotel-id, client-id: client-id }
      {
        rate: rate,
        start-date: start-date,
        end-date: end-date,
        active: true
      }
    ))
  )
)

;; Update an existing rate agreement
(define-public (update-rate-agreement
  (hotel-id principal)
  (client-id principal)
  (rate uint)
  (end-date uint))
  (let ((agreement (unwrap! (map-get? rate-agreements { hotel-id: hotel-id, client-id: client-id }) (err u3))))
    (begin
      (asserts! (or (is-eq tx-sender hotel-id) (is-admin)) (err u1))
      (asserts! (> end-date (get start-date agreement)) (err u2))
      (ok (map-set rate-agreements
        { hotel-id: hotel-id, client-id: client-id }
        (merge agreement {
          rate: rate,
          end-date: end-date
        })
      ))
    )
  )
)

;; Deactivate a rate agreement
(define-public (deactivate-rate-agreement (hotel-id principal) (client-id principal))
  (let ((agreement (unwrap! (map-get? rate-agreements { hotel-id: hotel-id, client-id: client-id }) (err u3))))
    (begin
      (asserts! (or (is-eq tx-sender hotel-id) (is-admin)) (err u1))
      (ok (map-set rate-agreements
        { hotel-id: hotel-id, client-id: client-id }
        (merge agreement { active: false })
      ))
    )
  )
)

;; Get rate agreement details
(define-read-only (get-rate-agreement (hotel-id principal) (client-id principal))
  (map-get? rate-agreements { hotel-id: hotel-id, client-id: client-id })
)

;; Check if rate agreement is active
(define-read-only (is-agreement-active (hotel-id principal) (client-id principal))
  (match (map-get? rate-agreements { hotel-id: hotel-id, client-id: client-id })
    agreement (and
                (get active agreement)
                (>= (get end-date agreement) block-height)
                (<= (get start-date agreement) block-height))
    false
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err u1))
    (ok (var-set admin new-admin))
  )
)

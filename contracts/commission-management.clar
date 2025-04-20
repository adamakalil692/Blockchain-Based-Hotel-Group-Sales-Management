;; Commission Management Contract
;; Handles payments to travel agencies

(define-data-var admin principal tx-sender)

;; Map to store commission rates for travel agencies
(define-map commission-rates
  { hotel-id: principal, agency-id: principal }
  {
    rate-percentage: uint,
    active: bool
  }
)

;; Map to track commission payments
(define-map commission-payments
  { hotel-id: principal, agency-id: principal, booking-id: (string-utf8 50) }
  {
    amount: uint,
    booking-value: uint,
    paid: bool,
    payment-date: uint
  }
)

;; Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Set commission rate for a travel agency
(define-public (set-commission-rate
  (hotel-id principal)
  (agency-id principal)
  (rate-percentage uint))
  (begin
    (asserts! (or (is-eq tx-sender hotel-id) (is-admin)) (err u1))
    (asserts! (<= rate-percentage u100) (err u2)) ;; Ensure rate is not more than 100%
    (ok (map-set commission-rates
      { hotel-id: hotel-id, agency-id: agency-id }
      {
        rate-percentage: rate-percentage,
        active: true
      }
    ))
  )
)

;; Deactivate commission rate
(define-public (deactivate-commission-rate (hotel-id principal) (agency-id principal))
  (let ((rate (unwrap! (map-get? commission-rates { hotel-id: hotel-id, agency-id: agency-id }) (err u3))))
    (begin
      (asserts! (or (is-eq tx-sender hotel-id) (is-admin)) (err u1))
      (ok (map-set commission-rates
        { hotel-id: hotel-id, agency-id: agency-id }
        (merge rate { active: false })
      ))
    )
  )
)

;; Record a commission payment
(define-public (record-commission
  (hotel-id principal)
  (agency-id principal)
  (booking-id (string-utf8 50))
  (booking-value uint))
  (let (
    (rate (unwrap! (map-get? commission-rates { hotel-id: hotel-id, agency-id: agency-id }) (err u3)))
    (commission-amount (/ (* booking-value (get rate-percentage rate)) u100))
  )
    (begin
      (asserts! (or (is-eq tx-sender hotel-id) (is-admin)) (err u1))
      (asserts! (get active rate) (err u4))
      (ok (map-set commission-payments
        { hotel-id: hotel-id, agency-id: agency-id, booking-id: booking-id }
        {
          amount: commission-amount,
          booking-value: booking-value,
          paid: false,
          payment-date: u0
        }
      ))
    )
  )
)

;; Mark commission as paid
(define-public (pay-commission
  (hotel-id principal)
  (agency-id principal)
  (booking-id (string-utf8 50)))
  (let ((payment (unwrap! (map-get? commission-payments { hotel-id: hotel-id, agency-id: agency-id, booking-id: booking-id }) (err u5))))
    (begin
      (asserts! (or (is-eq tx-sender hotel-id) (is-admin)) (err u1))
      (ok (map-set commission-payments
        { hotel-id: hotel-id, agency-id: agency-id, booking-id: booking-id }
        (merge payment {
          paid: true,
          payment-date: block-height
        })
      ))
    )
  )
)

;; Get commission rate
(define-read-only (get-commission-rate (hotel-id principal) (agency-id principal))
  (map-get? commission-rates { hotel-id: hotel-id, agency-id: agency-id })
)

;; Get commission payment details
(define-read-only (get-commission-payment (hotel-id principal) (agency-id principal) (booking-id (string-utf8 50)))
  (map-get? commission-payments { hotel-id: hotel-id, agency-id: agency-id, booking-id: booking-id })
)

;; Calculate total unpaid commissions for an agency
(define-read-only (get-unpaid-commissions (hotel-id principal) (agency-id principal))
  ;; Note: In a real implementation, this would require iterating through all payments
  ;; which is not directly supported in Clarity. This would need to be implemented
  ;; off-chain or with a different approach.
  u0
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err u1))
    (ok (var-set admin new-admin))
  )
)

;; Room Allocation Contract
;; Tracks usage against contracted minimums

(define-data-var admin principal tx-sender)

;; Map to store room allocation contracts
(define-map allocation-contracts
  { hotel-id: principal, client-id: principal }
  {
    total-rooms: uint,
    used-rooms: uint,
    minimum-commitment: uint,
    start-date: uint,
    end-date: uint
  }
)

;; Map to track individual bookings
(define-map bookings
  { hotel-id: principal, client-id: principal, booking-id: (string-utf8 50) }
  {
    rooms: uint,
    check-in: uint,
    check-out: uint,
    fulfilled: bool
  }
)

;; Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Create a new allocation contract
(define-public (create-allocation-contract
  (hotel-id principal)
  (client-id principal)
  (total-rooms uint)
  (minimum-commitment uint)
  (start-date uint)
  (end-date uint))
  (begin
    (asserts! (or (is-eq tx-sender hotel-id) (is-admin)) (err u1))
    (asserts! (>= total-rooms minimum-commitment) (err u2))
    (asserts! (> end-date start-date) (err u3))
    (ok (map-set allocation-contracts
      { hotel-id: hotel-id, client-id: client-id }
      {
        total-rooms: total-rooms,
        used-rooms: u0,
        minimum-commitment: minimum-commitment,
        start-date: start-date,
        end-date: end-date
      }
    ))
  )
)

;; Record a new booking against the allocation
(define-public (record-booking
  (hotel-id principal)
  (client-id principal)
  (booking-id (string-utf8 50))
  (rooms uint)
  (check-in uint)
  (check-out uint))
  (let (
    (contract (unwrap! (map-get? allocation-contracts { hotel-id: hotel-id, client-id: client-id }) (err u4)))
    (new-used-rooms (+ (get used-rooms contract) rooms))
  )
    (begin
      (asserts! (or (is-eq tx-sender client-id) (is-eq tx-sender hotel-id) (is-admin)) (err u1))
      (asserts! (<= new-used-rooms (get total-rooms contract)) (err u5))
      (asserts! (and (>= check-in (get start-date contract)) (<= check-out (get end-date contract))) (err u6))

      ;; Update the allocation contract with new used rooms
      (map-set allocation-contracts
        { hotel-id: hotel-id, client-id: client-id }
        (merge contract { used-rooms: new-used-rooms })
      )

      ;; Record the booking details
      (ok (map-set bookings
        { hotel-id: hotel-id, client-id: client-id, booking-id: booking-id }
        {
          rooms: rooms,
          check-in: check-in,
          check-out: check-out,
          fulfilled: false
        }
      ))
    )
  )
)

;; Mark a booking as fulfilled
(define-public (fulfill-booking
  (hotel-id principal)
  (client-id principal)
  (booking-id (string-utf8 50)))
  (let ((booking (unwrap! (map-get? bookings { hotel-id: hotel-id, client-id: client-id, booking-id: booking-id }) (err u7))))
    (begin
      (asserts! (is-eq tx-sender hotel-id) (err u1))
      (ok (map-set bookings
        { hotel-id: hotel-id, client-id: client-id, booking-id: booking-id }
        (merge booking { fulfilled: true })
      ))
    )
  )
)

;; Get allocation contract details
(define-read-only (get-allocation-contract (hotel-id principal) (client-id principal))
  (map-get? allocation-contracts { hotel-id: hotel-id, client-id: client-id })
)

;; Get booking details
(define-read-only (get-booking (hotel-id principal) (client-id principal) (booking-id (string-utf8 50)))
  (map-get? bookings { hotel-id: hotel-id, client-id: client-id, booking-id: booking-id })
)

;; Check if minimum commitment is met
(define-read-only (is-minimum-commitment-met (hotel-id principal) (client-id principal))
  (match (map-get? allocation-contracts { hotel-id: hotel-id, client-id: client-id })
    contract (>= (get used-rooms contract) (get minimum-commitment contract))
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

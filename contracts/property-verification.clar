;; Property Verification Contract
;; This contract validates legitimate accommodation providers

(define-data-var admin principal tx-sender)

;; Map to store verified properties
(define-map verified-properties
  principal
  {
    name: (string-utf8 100),
    location: (string-utf8 100),
    verified: bool,
    verification-date: uint
  }
)

;; Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Add a new property to the verified list
(define-public (register-property (property-owner principal) (name (string-utf8 100)) (location (string-utf8 100)))
  (begin
    (asserts! (is-admin) (err u1))
    (ok (map-set verified-properties
      property-owner
      {
        name: name,
        location: location,
        verified: false,
        verification-date: u0
      }
    ))
  )
)

;; Verify a property
(define-public (verify-property (property-owner principal))
  (let ((property (unwrap! (map-get? verified-properties property-owner) (err u2))))
    (begin
      (asserts! (is-admin) (err u1))
      (ok (map-set verified-properties
        property-owner
        (merge property {
          verified: true,
          verification-date: block-height
        })
      ))
    )
  )
)

;; Check if a property is verified
(define-read-only (is-property-verified (property-owner principal))
  (match (map-get? verified-properties property-owner)
    property (ok (get verified property))
    (err u3)
  )
)

;; Get property details
(define-read-only (get-property-details (property-owner principal))
  (map-get? verified-properties property-owner)
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err u1))
    (ok (var-set admin new-admin))
  )
)

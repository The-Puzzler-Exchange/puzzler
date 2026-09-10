# Puzzle exchange marketplace

Members exchange puzzles with credits. Shipping is a separate money payment to the platform.

## Language

**Member**:
A signed-in marketplace user.
_Avoid_: account

**Customer**:
The member who starts an exchange and receives the puzzle.
_Avoid_: buyer (in code and docs; fine in UI copy)

**Provider**:
The member who publishes the listing and ships the puzzle.
_Avoid_: seller (in code and docs; fine in UI copy)

**Exchange**:
A Sharetribe transaction where the customer takes one listing and pays with one credit. No money moves for the puzzle.
_Avoid_: purchase, order (when you mean this credit trade), sale

**Credit**:
One unit in the member's Firestore balance. One credit pays for one exchange.
_Avoid_: wallet, voucher, point

**Membership**:
The Stripe subscription that grants the right to publish listings.
_Avoid_: plan (unless you mean the Stripe Price)

**Shipping charge**:
Money the customer pays to the platform Stripe account for carrier shipping. It is not a Sharetribe pay-in. The provider does not receive it.
_Avoid_: shipping fee line item, Connect payment

**Shipping label**:
The carrier PDF the provider prints. The customer does not see it.
_Avoid_: postage, sticker

**Ship-from address**:
The provider's US origin address, stored on the member profile.
_Avoid_: listing location, pickup address

**Piece count**:
Listing public data `no_of_pieces`. Allowed values: 500, 1000, 2000.
_Avoid_: size, puzzle size (ambiguous with box size)

**Parcel**:
The package length, width, height, and weight used to request carrier rates.
_Avoid_: box (unless you mean the physical puzzle box)

**Listed rate**:
The Shippo carrier rate after the platform markup. This is the amount shown to the customer and charged by Stripe.
_Avoid_: shipping price (the old flat listing field)

**Carrier tracking**:
Shippo status for the shipment. In-transit marks the exchange delivered. Delivered marks the exchange received.
_Avoid_: delivery confirmation (the old manual button, unless the webhook has not fired)

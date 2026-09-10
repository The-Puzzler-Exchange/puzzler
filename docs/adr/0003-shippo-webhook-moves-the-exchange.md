# Shippo tracking moves the exchange

Manual “mark delivered” / “mark received” does not match a label-based shipment. When Shippo reports in transit, the operator transition marks the exchange delivered. When Shippo reports delivered, the operator transition marks it received. That also stops the 14-day auto-cancel from `purchased`, which is correct once the carrier has the parcel.

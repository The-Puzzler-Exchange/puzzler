# Charge shipping before the exchange, buy the label after

Loop Costumes buys the Shippo label during `request-payment`, before the card succeeds. That risks paying for a label when the card fails. Here the card is the only money in the flow, and a spent credit is not returned if confirm fails. So: confirm the shipping PaymentIntent first; if that succeeds, create the exchange and spend the credit; if that succeeds, buy the label. If the exchange fails after the charge, refund Stripe. If the label fails after the exchange, keep the exchange and let the provider retry.

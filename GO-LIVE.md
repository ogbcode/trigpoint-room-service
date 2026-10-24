# Going live: room service on WhatsApp

**What it does.** Guests order food and drinks from an AI agent on WhatsApp. It checks the room number against the guests staying, prices the order and sends a docket to the kitchen and a ticket to the bar. Staff get the tickets once a Paystack payment is confirmed, or at once for a room charge, as the hotel does today. The front desk then accepts or declines each room charge on the staff board.

**What it does not do.** Guests must ask for updates, such as whether a payment went through; the agent cannot send them on its own. It does not count stock, take walk-in orders or confirm allergies. Guests dial 0 for changes, cancellations, complaints, refunds and allergy checks.

**Before real guests use it**

- Connect it to the hotel system for real bookings and the real menu. Today both are made up.
- Switch Paystack to live payments once it has verified the business. Every booking needs an email for the payment link.
- Connect the hotel's WhatsApp number to Chord, the service the agent runs on.
- Set up failure alerts to the developer. Today nobody is told when it breaks.
- Recognise guests by the WhatsApp number recorded at check-in. Today anyone who names a room can charge food to it.

**When things go wrong**

- A payment fails: nothing goes out, and the guest can retry or ask for a new link.
- A guest pays twice: the board shows "paid twice, refund needed", and the front desk refunds it in Paystack.
- The front desk declines a room charge: staff tell the guest, who can ask the agent for a payment link.
- The order system is down: the agent asks guests to dial 0. If Chord or WhatsApp is down, guests get no reply.

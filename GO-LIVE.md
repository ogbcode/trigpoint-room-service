# Going live: room service on WhatsApp

**What it does.** Guests order food and drinks from an AI agent on WhatsApp. It checks their room number against the guests staying, prices the order and sends a docket to the kitchen and a ticket to the bar. Paid by Paystack link, the order goes out once the payment is confirmed. Charged to the room, it goes out at once and the front desk accepts or declines the charge on the staff order board.

**What it does not do.** It never messages a guest first, so it cannot say a payment landed, the food is ready or a room charge was declined; the guest asks and it answers. It does not count stock, take walk-in orders or confirm allergies. Guests dial 0 for changes, cancellations, complaints, refunds and allergy checks.

**Before real guests use it**

- Connect it to the hotel system for real bookings and the real menu, so orders land where staff already work. Today both are made up.
- Switch Paystack to live payments once it has verified the business. Every booking needs an email for the payment link.
- Connect the hotel's WhatsApp number to Chord, the service the agent runs on.
- Name who gets alerted when it breaks. Today nobody is: errors only reach the developer's logs.
- Recognise guests by the WhatsApp number the front desk records at check-in. Today the agent asks only for the room number, so anyone who names a room can charge food to it.

**When things go wrong**

- A payment fails: nothing goes out, and the guest can retry or ask for a new link.
- A guest pays twice: the board shows "paid twice, refund needed", and the front desk refunds it in Paystack.
- The front desk declines a room charge: staff tell the guest, who can ask the agent for a payment link.
- The order system is down: the agent asks guests to dial 0. If Chord or WhatsApp is down, guests get no reply.

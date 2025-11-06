Order Import Logic Overview

The order import process involves:

Fetching selected backers and their associated product mappings from the database.

For each backer, constructing a Shopify order with:Mapped products (reward and add-ons) with quantities.

Custom order number (KS-XXXXXXXXXX).
Tags (Kickstarter).
Buyer marketing opt-in (buyer_accepts_marketing = true).
Financial and fulfillment status.
Notes

Sending the order to Shopify’s Admin API.

Marking successful imports in the database and logging failures.

Returning a summary of successes and failures.


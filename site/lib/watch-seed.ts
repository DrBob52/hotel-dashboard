export const seedCriteria = {
  "lower-manhattan-weeknights": {
    "name": "Lower Manhattan weeknights",
    "text": "Marriott MMP Explore Associate & Family rates, not regular or Friends-rate fallbacks.\n$70 or less per night before taxes. Show the full total including mandatory taxes/fees.\nUnder 45 minutes by public transit to 230 Vesey Street, New York, NY, including walking, ordinary waits and transfers.\nSearch the next four upcoming weeks (check-in from today through today + 28 days).\nPrefer three nights: Sunday–Wednesday, Monday–Thursday or Tuesday–Friday.\nInclude two-night backups: Sunday–Tuesday, Monday–Wednesday, Tuesday–Thursday or Wednesday–Friday.\nCheck out no later than Friday morning. No Friday-night stays.\nOne hotel for the entire stay, not split bookings.\nResidence Inn Jersey City is the benchmark for the kind of hotel and location I like.",
    "paused": false,
    "order": 1,
    "version": 1,
    "commute": {
      "destination": "230 Vesey Street, New York, NY",
      "maxMinutes": 45,
      "comparison": "lt",
      "mode": "transit",
      "arriveBy": "09:00"
    },
    "price": {
      "amount": 70,
      "comparison": "lte",
      "per": "night",
      "basis": "pretax"
    },
    "dates": {
      "mode": "rolling",
      "rollingDays": 28,
      "from": null,
      "to": null,
      "checkoutBy": null,
      "noFridayNights": true,
      "stays": [
        {
          "dow": 0,
          "nights": 3,
          "tier": 1
        },
        {
          "dow": 1,
          "nights": 3,
          "tier": 1
        },
        {
          "dow": 2,
          "nights": 3,
          "tier": 1
        },
        {
          "dow": 0,
          "nights": 2,
          "tier": 2
        },
        {
          "dow": 1,
          "nights": 2,
          "tier": 2
        },
        {
          "dow": 2,
          "nights": 2,
          "tier": 2
        },
        {
          "dow": 3,
          "nights": 2,
          "tier": 2
        }
      ]
    },
    "rates": {
      "accept": "mmp-explore",
      "combinedLabelPolicy": "explicit_associate_evidence_required"
    },
    "areas": [
      "Lower Manhattan",
      "Jersey City",
      "Hoboken",
      "Newark near Penn Station/PATH",
      "Brooklyn",
      "Long Island City/Queens"
    ],
    "benchmark": "Residence Inn by Marriott Jersey City"
  },
  "one-night-over-the-holidays": {
    "name": "One night over the holidays",
    "text": "One night at a Marriott MMP Explore Associate & Family rate, in or very close to New York City.\nCheck-in any night December 22–26, 2026 (check out by December 27).\n$80 or less per night total, including taxes and mandatory fees.\nUnder 45 minutes by public transit to 230 Vesey Street, New York, NY.",
    "paused": false,
    "order": 2,
    "version": 1,
    "commute": {
      "destination": "230 Vesey Street, New York, NY",
      "maxMinutes": 45,
      "comparison": "lt",
      "mode": "transit",
      "arriveBy": "09:00"
    },
    "price": {
      "amount": 80,
      "comparison": "lte",
      "per": "night",
      "basis": "total"
    },
    "dates": {
      "mode": "fixed",
      "rollingDays": null,
      "from": "2026-12-22",
      "to": "2026-12-26",
      "checkoutBy": "2026-12-27",
      "noFridayNights": false,
      "stays": [
        {
          "dow": 0,
          "nights": 1,
          "tier": 1
        },
        {
          "dow": 1,
          "nights": 1,
          "tier": 1
        },
        {
          "dow": 2,
          "nights": 1,
          "tier": 1
        },
        {
          "dow": 3,
          "nights": 1,
          "tier": 1
        },
        {
          "dow": 4,
          "nights": 1,
          "tier": 1
        },
        {
          "dow": 5,
          "nights": 1,
          "tier": 1
        },
        {
          "dow": 6,
          "nights": 1,
          "tier": 1
        }
      ]
    },
    "rates": {
      "accept": "mmp-explore",
      "combinedLabelPolicy": "explicit_associate_evidence_required"
    },
    "areas": [
      "Lower Manhattan",
      "Jersey City",
      "Hoboken",
      "Newark near Penn Station/PATH",
      "Brooklyn",
      "Long Island City/Queens"
    ],
    "benchmark": null
  }
};

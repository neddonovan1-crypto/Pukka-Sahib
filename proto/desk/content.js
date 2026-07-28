/* One cold-weather fortnight, as data.

   Terse per docs/DESIGN-DESK.md §10 — telegram ≤ 25 words, file note ≤ 40,
   petition ≤ 35, report ≤ 50. The prose carries no explanation: what a paper
   omits is as loud as what it says, and the player is never told which.

   Outcomes are a line and a set of deltas. Note that no stamp is simply
   correct: NO ACTION is right on most of these and ruinous on one, and the
   document does not tell you which one. (§13, rule 3.)                     */
window.FORTNIGHT = {
  station: "Chhota Nagra",
  rank: "District Magistrate & Collector",
  season: "cold",
  seasonLabel: "Cold weather",
  fortnight: 3,
  dateFrom: "15 Nov",
  dateTo: "28 Nov",
  year: 1925,
  days: 14,

  // The rack. Four at this rank; a promotion adds to it.
  stamps: [
    { id: "sanction", label: "Sanctioned", days: 1 },
    { id: "refer",    label: "Referred",   days: 1 },
    { id: "none",     label: "No action",  days: 1 },
    { id: "report",   label: "Called for report", days: 1 }
  ],

  // Who you can push a stack onto. Standing decides what comes back.
  clerks: [
    { id: "munshi", name: "Munshi Lal Ram", post: "Tahsildar, Marwa", standing: "good",
      note: "Backed him over the arrears last year." },
    { id: "dutt",   name: "B. K. Dutt", post: "Head Clerk", standing: "fair",
      note: "Competent. Says little." },
    { id: "sahai",  name: "R. Sahai", post: "Tahsildar, Deoganj", standing: "poor",
      note: "You passed him over. He has not forgotten." }
  ],

  docs: [
    {
      id: "wire-riot", form: "telegram", urgent: true,
      from: "Supdt. Police, Bhagalpur", ref: "Hd. 41",
      body: "RIOT BHAGALPUR BAZAAR 14TH NIGHT STOP TWO DEAD STOP POLICE FIRED STOP REPORT BY RETURN STOP COMMISSIONER REQUIRES EXPLANATION",
      ride: { label: "Ride to Bhagalpur", days: 4 },
      outcomes: {
        sanction: { line: "You endorse the Superintendent's account and forward it.", d: { order: 4, prestige: -3, contentment: -6 } },
        refer:    { line: "Passed to the Commissioner. It is now his difficulty, and his opinion of you.", d: { prestige: -5, order: 2 } },
        none:     { line: "Nothing is done. The Division will notice that nothing was done.", d: { order: -8, prestige: -10, contentment: -4 } },
        report:   { line: "You call for a report. It arrives in nine days and says very little.", d: { order: 1, prestige: -2 } },
        ride:     { line: "You are there by the 19th. The firing was worse than reported, and the crowd smaller.", d: { order: 6, prestige: 4, contentment: -2, health: -3 } }
      }
    },
    {
      id: "file-revenue", form: "file", stampFee: null,
      from: "Tahsildar, Marwa", ref: "File 112–C · Kharif settlement",
      body: "Collections at 61 per cent. Attributes the shortfall to the late rains and recommends no remission. The village of Marwa is not mentioned.",
      ride: { label: "Ride to Marwa", days: 4 },
      outcomes: {
        sanction: { line: "The return goes up as it stands. Simla is content.", d: { revenue: 6, contentment: -7 } },
        refer:    { line: "Sent to the Collector's office for scrutiny. It will sit there.", d: { revenue: 1 } },
        none:     { line: "Filed. The figures stand.", d: { revenue: 4, contentment: -5 } },
        report:   { line: "You call for the village papers. Marwa has paid nothing in two years.", d: { revenue: -2, order: 3, contentment: 3 } },
        ride:     { line: "Marwa is half empty. The rest have gone to the canal works in Sirsa.", d: { revenue: -4, contentment: 8, prestige: 2, health: -3 } }
      }
    },
    {
      id: "petition-well", form: "petition", stampFee: "Eight Annas",
      from: "The cultivators of Sirsa", ref: "Petition 44 of 1925",
      body: "The well at Sirsa has fallen in. Sixty households draw from it. We have paid the fee. We ask that it be dug again before the hot weather.",
      outcomes: {
        sanction: { line: "Sanctioned from the district fund. It will be dug by March.", d: { contentment: 7, revenue: -5, prestige: 2 } },
        refer:    { line: "Referred to the Public Works Department, who will refer it back.", d: { contentment: -3 } },
        none:     { line: "Filed with the others.", d: { contentment: -6, revenue: 1 } },
        report:   { line: "The Tahsildar reports the well is 'serviceable'. He has not seen it.", d: { contentment: -4, revenue: 1 } }
      }
    },
    {
      id: "report-dacoity", form: "report", secret: true,
      from: "Sub-Inspector, Deoganj", ref: "Confidential",
      body: "Enquiries into the dacoity at Panipat continue. Four persons are suspected. No arrests have been made. The complainant has withdrawn his complaint. No further particulars.",
      outcomes: {
        sanction: { line: "You endorse the enquiry as satisfactory.", d: { order: 2, contentment: -4 } },
        refer:    { line: "Sent to the Superintendent, who has read a hundred like it.", d: { order: 1 } },
        none:     { line: "Filed.", d: { order: -2, contentment: -2 } },
        report:   { line: "You ask why the complaint was withdrawn. The answer does not come.", d: { order: 3, prestige: -2, contentment: 2 } }
      }
    },
    {
      id: "order-tour", form: "order",
      from: "The Commissioner, Sonepore", ref: "D.O. 2117",
      body: "Your tour programme for the cold weather has not been received. It is required by the end of the month.",
      outcomes: {
        sanction: { line: "You submit a programme. Whether you keep to it is another matter.", d: { prestige: 3 } },
        refer:    { line: "There is nobody to refer it to. The clerk looks at you.", d: { prestige: -3 } },
        none:     { line: "Ignored. The Commissioner does not forget a second time.", d: { prestige: -7 } },
        report:   { line: "You ask what form is required. This is not the impression you wished to give.", d: { prestige: -2 } }
      }
    },
    {
      id: "file-boundary", form: "file",
      from: "Kanungo, Kotra", ref: "File 88–B · Boundary",
      body: "Two brothers at Kotra dispute a field boundary of one-third of an acre. The papers run to forty pages. Both have been to the tehsil eleven times.",
      hear: { label: "Hear them yourself", days: 2 },
      outcomes: {
        sanction: { line: "You confirm the elder's claim. The younger will appeal.", d: { order: 1, contentment: -2 } },
        refer:    { line: "Referred to the civil court, where it will outlive all three of you.", d: { contentment: -1 } },
        none:     { line: "Filed. They will come again.", d: { contentment: -2 } },
        report:   { line: "You call for a survey. It costs four rupees and settles nothing.", d: { revenue: -1, contentment: -1 } },
        hear:     { line: "You hear them for two hours. They agree to divide it. Neither is satisfied; both are finished.", d: { contentment: 5, prestige: 2, order: 2 } }
      }
    },
    {
      id: "club-dinner", form: "note",
      from: "The Secretary, Chhota Nagra Club", ref: "Private",
      body: "The Club dines on the 26th. Your absence at the last two has been remarked upon. Kindly reply.",
      outcomes: {
        sanction: { line: "You accept. The evening is exactly as long as you feared.", d: { prestige: 5, health: -2 } },
        refer:    { line: "You have your clerk reply. The Club knows what that means.", d: { prestige: -4 } },
        none:     { line: "No reply is sent. It is remarked upon a third time.", d: { prestige: -6 } },
        report:   { line: "You ask who else is attending. The Secretary finds this very odd.", d: { prestige: -1 } }
      }
    },
    {
      id: "conf-tahsildar", form: "file", secret: true,
      from: "Anonymous", ref: "Received by hand",
      body: "The Tahsildar of Deoganj takes two annas in the rupee on every remission he recommends. The writer does not give his name and asks that this be looked into quietly.",
      outcomes: {
        sanction: { line: "You act on it. Sahai is suspended, and denies everything.", d: { order: 4, revenue: 2, prestige: -4, contentment: 3 } },
        refer:    { line: "Referred upward. Anonymous complaints do not travel well.", d: { prestige: -2 } },
        none:     { line: "Burnt, as anonymous letters usually are.", d: { contentment: -3 } },
        report:   { line: "You ask the Head Clerk, quietly. He is careful, and tells you enough.", d: { order: 2, contentment: 2, prestige: 1 } }
      }
    }
  ],

  // The road, this fortnight. Cold weather: the season the tour belongs to.
  road: {
    intro: "The cold weather. The tents go out on the 17th if they go at all.",
    stops: [
      { id: "marwa",     name: "Marwa",     days: 3, mx: 0.30, my: 0.30, cond: 0.72, art: "paint-fields",
        diary: "Marwa. Half the houses shut up. They have gone to the canal works and the Tahsildar's return says nothing of it. Collections here are a fiction." },
      { id: "sirsa",     name: "Sirsa",     days: 2, mx: 0.22, my: 0.68, cond: 0.40, art: "paint-tour-camp",
        diary: "Sirsa. Heard eleven cases under the tree by the well — which is indeed fallen in, and worse than the petition said. Sixty households and a mile to the next water." },
      { id: "bhagalpur", name: "Bhagalpur", days: 4, mx: 0.63, my: 0.28, cond: 0.55, art: "paint-durbar",
        diary: "Bhagalpur. The bazaar quiet, the shutters down. Two men dead on the 14th and nobody will say who fired first. The Superintendent's account is tidier than the street." },
      { id: "deoganj",   name: "Deoganj",   days: 3, mx: 0.76, my: 0.70, cond: 0.20, art: "paint-flood-relief",
        diary: "Deoganj. Sahai met me at the boundary with a great deal of ceremony and a very clean set of books. The cultivators would not look at me." }
    ]
  }
};

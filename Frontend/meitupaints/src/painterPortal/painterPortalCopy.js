// Every word the painter portal can say, in both languages. Nepali is the
// default: the audience is painters, not office staff.
//
// NEPALI REVIEW: these lines were drafted by a developer, not a native
// speaker. Read them once and correct anything that sounds wrong - they are
// the entire portal, so a clumsy phrase here is the whole experience.
export const COPY = {
  ne: {
    dir: "ne",
    brand: "मेइतु पेन्टर पोइन्ट",
    searchTitle: "आफ्नो पोइन्ट हेर्नुहोस्",
    searchHint: "आफ्नो पेन्टर आईडी, नागरिकता नम्बर वा फोन नम्बर हाल्नुहोस्",
    placeholder: "जस्तै: TTP017347",
    submit: "मेरो पोइन्ट हेर्नुहोस्",
    searching: "खोज्दै…",
    greeting: (name) => `नमस्ते, ${name}`,
    fiscalYear: (label) => (label ? `यो आर्थिक वर्ष (${label})` : "यो आर्थिक वर्ष"),
    allTime: "जम्मा पोइन्ट",
    pointsWord: "पोइन्ट",
    nextGift: "अर्को उपहार",
    pointsToGo: (n) => `${n} पोइन्ट बाँकी`,
    earned: "प्राप्त भयो",
    allGifts: "सबै उपहार",
    noGifts: "अहिलेसम्म कुनै उपहार राखिएको छैन।",
    allEarned: "तपाईंले सबै उपहार प्राप्त गर्नुभयो!",
    searchAgain: "फेरि खोज्नुहोस्",
    notFound: "यो आईडी फेला परेन। आफ्नो कार्डको नम्बर जाँच्नुहोस्, वा आफ्नो डिलरलाई सोध्नुहोस्।",
    tooShort: "कृपया पूरा आईडी वा फोन नम्बर हाल्नुहोस्।",
    rateLimited: "धेरै पटक खोजियो। केही मिनेट पर्खेर फेरि प्रयास गर्नुहोस्।",
    failed: "केही गडबड भयो। फेरि प्रयास गर्नुहोस्।",
    inactive: "तपाईंको खाता अहिले सक्रिय छैन। कृपया मेइतुलाई सम्पर्क गर्नुहोस्।",
    zeroPoints: "अहिलेसम्म कुनै पोइन्ट छैन। कुपन स्क्यान गर्न आफ्नो डिलरलाई भन्नुहोस्।",
    langButton: "English",
  },
  en: {
    dir: "en",
    brand: "Meitu Painter Points",
    searchTitle: "See your points",
    searchHint: "Enter your Painter ID, citizenship number or phone number",
    placeholder: "e.g. TTP017347",
    submit: "See my points",
    searching: "Searching…",
    greeting: (name) => `Namaste, ${name}`,
    fiscalYear: (label) => (label ? `This fiscal year (${label})` : "This fiscal year"),
    allTime: "Total points",
    pointsWord: "points",
    nextGift: "Next gift",
    pointsToGo: (n) => `${n} points to go`,
    earned: "Earned",
    allGifts: "All gifts",
    noGifts: "No gifts have been listed yet.",
    allEarned: "You have earned every gift!",
    searchAgain: "Search again",
    notFound: "We could not find that ID. Check the number on your card, or ask your dealer.",
    tooShort: "Please enter your full ID or phone number.",
    rateLimited: "Too many searches. Please wait a few minutes and try again.",
    failed: "Something went wrong. Please try again.",
    inactive: "Your account is not active right now. Please contact Meitu.",
    zeroPoints: "No points yet. Ask your dealer to scan your coupons.",
    langButton: "नेपाली",
  },
};

const NEPALI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

// A painter reading Nepali should see Nepali numerals - the points total is
// the one thing on the screen they really read.
export function formatNumber(value, lang) {
  return localizeDigits(Number(value || 0).toLocaleString("en-IN"), lang);
}

// Also used on the fiscal-year label, which an admin types as "2083/84" and a
// Nepali reader should see as "२०८३/८४".
export function localizeDigits(text, lang) {
  const value = String(text ?? "");
  if (lang !== "ne") return value;
  return value.replace(/\d/g, (digit) => NEPALI_DIGITS[Number(digit)]);
}

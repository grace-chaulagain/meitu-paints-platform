/**
 * Seed (append-only) the Painter contact directory from a fixed, hardcoded
 * dataset (Painter_Contact_Details.txt, 150 records). Safe to re-run - if
 * the collection is already non-empty, it exits without writing anything
 * rather than upserting per-record, since names in the source data are not
 * unique (a few duplicates are different people with different phones).
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/seed-painters.js
 */

import "dotenv/config";
import mongoose from "mongoose";
import Painter from "../models/Painter.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

function phones(raw) {
  return raw
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean);
}

const PAINTERS = [
  { name: "Lal Bahadur Pandey", phones: phones("9806020850"), address: "Birtamode, Jhapa" },
  { name: "Prakash Giri", phones: phones("9810007296"), address: "Kalabazar, Sunsari" },
  { name: "Jay Narayan Chaudhari", phones: phones("9803665808"), address: "Kalabazar, Sunsari" },
  { name: "Mohan Shrestha", phones: phones("9841195356 / 9818177774"), address: "Gokarna, Chitwan" },
  { name: "Sunil Dagaura Tharu", phones: phones("9822254447"), address: "Chitwan" },
  { name: "Anil Dagaura Tharu", phones: phones("9843429487"), address: "Chitwan" },
  { name: "Bishnu Adhikari", phones: phones("9842688492"), address: "Damak, Jhapa" },
  { name: "Rajendra Dhimal", phones: phones("9823551160"), address: "Damak, Jhapa" },
  { name: "Kapil Acharya", phones: phones("9823400754"), address: "Damak, Jhapa" },
  { name: "Yam Bahardur Kadel", phones: phones("9817412548"), address: "Butwal" },
  { name: "Budhhi Bahadur Pun", phones: phones("9845855023"), address: "Hetauda" },
  { name: "Govinda Thapa", phones: phones("9861931280"), address: "Hetauda" },
  { name: "Indra Raj Dhungana", phones: phones("9841429432"), address: "Hetauda" },
  { name: "Raj Kumar Shrestha", phones: phones("9846217176"), address: "Hetauda" },
  { name: "Dipesh Tamang", phones: phones("9828005131"), address: "Chitwan" },
  { name: "Himal Subba", phones: phones("9819369947"), address: "Pathari, Morang" },
  { name: "Birendra Limbu", phones: phones("9745865418"), address: "Pathari, Morang" },
  { name: "Raja Ghimire", phones: phones("9824973618"), address: "Jhiljhile, Jhapa" },
  { name: "Sacham Rai", phones: phones("9815085702"), address: "Jhiljhile, Jhapa" },
  { name: "Jivan Shrestha", phones: phones("9828977119"), address: "Jhiljhile, Jhapa" },
  { name: "Kamal Karki", phones: phones("9852058097"), address: "Mulpani" },
  { name: "Nar Bahadur Tamang", phones: phones("9843519479"), address: "Duwakot" },
  { name: "Pujan Manandhar", phones: phones("9840026048"), address: "Banepa" },
  { name: "Shree Krishna Gautam", phones: phones("9841867723"), address: "Banepa" },
  { name: "Sunil Manandhar", phones: phones("9803616685"), address: "Banepa" },
  { name: "Bedbyas Bimali", phones: phones("9851201109"), address: "Koteshwor" },
  { name: "Dhanesh Kumar Shah", phones: phones("9805866015"), address: "Baghbazar" },
  { name: "Pemba Sherpa", phones: phones("9843006570"), address: "Boudha" },
  { name: "Irfan Ahmed", phones: phones("9817418841"), address: "Butwal" },
  { name: "Santosh Kumar Shrestha", phones: phones("9841421858"), address: "Thali" },
  { name: "Kailash Bahadur Khatri", phones: phones("9817727804"), address: "Udaypur" },
  { name: "Ram Hari Ale", phones: phones("9808516120"), address: "Kapan" },
  { name: "Vijay Khadka", phones: phones("9860052181"), address: "Jaybageswori" },
  { name: "Rupak Karki", phones: phones("9817713846"), address: "Udaypur" },
  { name: "Krishna Bahadur Bholan", phones: phones("9851234960"), address: "Kavre (Pepsicola)" },
  { name: "Biswas Waiba", phones: phones("9847693384"), address: "Godawori" },
  { name: "Sher Bahadur Rokka", phones: phones("9816085263"), address: "Jhapa" },
  { name: "Imanuyal Limbu", phones: phones("9808210459"), address: "Morang" },
  { name: "Dipesh Limbu", phones: phones("9827056807"), address: "Morang" },
  { name: "Chhatra Narayan Shrestha", phones: phones("9860883897 / 9803511404"), address: "Lalbandi-10, Sarlahi" },
  { name: "Manoj Shrestha", phones: phones("9813817706 / 9746673806"), address: "Lalbandi-8, Sarlahi" },
  { name: "Raj Kumar Shrestha", phones: phones("9801608747 / 9816519486"), address: "Lalbandi-4, Sarlahi" },
  { name: "Sabin Kumar Shrestha", phones: phones("9845426362"), address: "Sindhuli-6, Palanse" },
  { name: "Som Bahadur Gyaba", phones: phones("9814852202"), address: "Lalbandi-6, Sarlahi" },
  { name: "Bashanta Regmi Magar", phones: phones("9863554711 / 9817624314"), address: "Lalbandi-5, Sarlahi" },
  { name: "Bal Bahadur Limbu", phones: phones("9851322856"), address: "Naya Baneswor, Taplejung" },
  { name: "Ambar Bahadur Bayalkoti", phones: phones("9841980803"), address: "Naya Baneswor, Okhaldhunga" },
  { name: "Raj Kumar Tamang", phones: phones("9848070532"), address: "Dolkha" },
  { name: "Durga Tamang", phones: phones("9843878299"), address: "Chyasing Kharka-3" },
  { name: "Pradip Kumar Karki", phones: phones("9828928030 / 9849425571"), address: "Ramechhap" },
  { name: "Bhakta Bahadur Magar", phones: phones("9749711076"), address: "Banepa" },
  { name: "Nil Limbu", phones: phones("9818707915"), address: "Jhapa" },
  { name: "Swagat Rai", phones: phones("9844225522"), address: "Jhapa, Fikkal" },
  { name: "Abhishek Shrestha", phones: phones("9823112333"), address: "Jhapa" },
  { name: "Ramsebak Chaudhary", phones: phones("9804707459"), address: "Udaypur" },
  { name: "Ram Sundar Chaudhary", phones: phones("9814779434"), address: "Udaypur" },
  { name: "Paresh Rajbanshi", phones: phones("9804906156"), address: "Jhapa" },
  { name: "Homraj Shrestha", phones: phones("9813894691"), address: "Jhapa" },
  { name: "Girendra Rajbanshi", phones: phones("9816984576"), address: "Jhapa" },
  { name: "Sukra Raj Limbu", phones: phones("9817989395"), address: "Jhapa" },
  { name: "Aindra Bikram Mukhiya", phones: phones("9810219221"), address: "Jhapa" },
  { name: "Dinesh Kumar Pandit", phones: phones("9807731958"), address: "Jhapa" },
  { name: "Rajdip Adhikari", phones: phones("9824036475"), address: "Jhapa" },
  { name: "Arun Kumar Pandit", phones: phones("9804022610"), address: "Jhapa" },
  { name: "Chandrasur Rai", phones: phones("9844222235"), address: "Ilam" },
  { name: "Birendra Tamrakar", phones: phones("9807935395"), address: "Jhapa" },
  { name: "Dravid Tamang", phones: phones("9827926288"), address: "Jhapa" },
  { name: "Raju Rai", phones: phones("9844211296"), address: "Jhapa" },
  { name: "Mohan Guragai", phones: phones("9824950028"), address: "Jhapa" },
  { name: "Arjun Rajbanshi", phones: phones("9816931637"), address: "Jhapa" },
  { name: "Siddartha Rai", phones: phones("9860973733"), address: "Jhapa" },
  { name: "Ganga Bahadur Tamang", phones: phones("9825436562"), address: "Urlabari" },
  { name: "Kashiram Chaudhary", phones: phones("9810661827"), address: "Dhangadi" },
  { name: "Ankit Chaudhary", phones: phones("9815616312"), address: "Dhangadi" },
  { name: "Ram Dev Chaudhary", phones: phones("9812697891"), address: "Dhangadi" },
  { name: "Lalit Yadav", phones: phones("9808329561"), address: "Saptari" },
  { name: "Karna Limbu", phones: phones("9822082022"), address: "Jhapa" },
  { name: "Cezzane Dahal", phones: phones("9826345447"), address: "Sunsari" },
  { name: "Nagendra Newar Shrestha", phones: phones("9845517605"), address: "Sunsari" },
  { name: "Biroj Pakhrin", phones: phones("9823044432"), address: "Pokhara" },
  { name: "Dil Kumar Shrestha", phones: phones("9860895174 / 9851277523"), address: "Banepa" },
  { name: "Shyam Prasad Dahal", phones: phones("9849343460"), address: "Banepa" },
  { name: "Dhan Bahadur Ghising", phones: phones("9840239850"), address: "Banepa" },
  { name: "Tabraj Alam", phones: phones("9840749909"), address: "Banepa" },
  { name: "Darjaman Lama", phones: phones("9851201852"), address: "Banepa" },
  { name: "Rajkumar Thapa", phones: phones("9849573165"), address: "Banepa" },
  { name: "Sahadev Khatri", phones: phones("9860701693"), address: "Banepa" },
  { name: "Rajesh Manandhar", phones: phones("9709045224"), address: "Banepa" },
  { name: "Rakesh Twanabasu", phones: phones("9841133658"), address: "Bhaktapur" },
  { name: "Ngema Gole", phones: phones("9745550608"), address: "Sindhupalchowk" },
  { name: "Naresh Lakha", phones: phones("9860077513"), address: "Bhaktapur" },
  { name: "Prakash Achhame", phones: phones("9869200483"), address: "Ramechhap" },
  { name: "Jasman Theeng", phones: phones("9869759589"), address: "Bhaktapur, Suryabinayak" },
  { name: "Nabin Kumar Lama", phones: phones("9818788412"), address: "Bhaktapur, Suryabinayak" },
  { name: "Ajay Tamang", phones: phones("9847309835"), address: "Bhaktapur, Suryabinayak" },
  { name: "Saroj Chaudhary", phones: phones("9860800432"), address: "Ghorahi, Dang" },
  { name: "Surendra Chaudhary", phones: phones("9847950625"), address: "Ghorahi, Dang" },
  { name: "Khemman Khadka", phones: phones("9708504377"), address: "Ghorahi, Dang" },
  { name: "Dilli Bahadur Pun", phones: phones("9748724207"), address: "Ghorahi, Dang" },
  { name: "Jibdhan Budha Magar", phones: phones("9868282529"), address: "Ghorahi, Dang" },
  { name: "Ser Bahadur Oli", phones: phones("9868611089"), address: "Ghorahi, Dang" },
  { name: "Dashrath Jaiswal", phones: phones("9829525189"), address: "Ghorahi, Dang" },
  { name: "Jut Bahadur Budha Magar", phones: phones("9866816724"), address: "Ghorahi, Dang" },
  { name: "Khim Raj Pun", phones: phones("9866938359"), address: "Ghorahi, Dang" },
  { name: "Rabin Rai", phones: phones("9706197789"), address: "Ilam" },
  { name: "Bikash Rai", phones: phones("9807928699"), address: "Ilam" },
  { name: "Junga Bahadur Baidhya", phones: phones("9811132695"), address: "Janakpur" },
  { name: "Ramsogarath Shah", phones: phones("9707642628"), address: "Janakpur" },
  { name: "Sahid Rain", phones: phones("9807847338"), address: "Janakpur" },
  { name: "Sushil Raut", phones: phones("9826454254"), address: "Janakpur" },
  { name: "Sochandra Mandal", phones: phones("9813980508"), address: "Janakpur" },
  { name: "Afjal Ansari", phones: phones("9812028011"), address: "Janakpur" },
  { name: "Irfan Ansari", phones: phones("9828791829"), address: "Belbas, Sarlahi" },
  { name: "Surya Bahadur Bohara", phones: phones("9828064927"), address: "Bhaktapur" },
  { name: "Narayan Bahadur Bohara", phones: phones("9818349120"), address: "Bhaktapur" },
  { name: "Pradip Chaudhary", phones: phones("9764682633"), address: "Kapilvastu" },
  { name: "Sanjay Tharu", phones: phones("9811446417"), address: "Kapilvastu" },
  { name: "Chinni Ram Chaudhary", phones: phones("9864557910"), address: "Kapilvastu" },
  { name: "Jitendra Kumar", phones: phones("9812278572"), address: "Dumre" },
  { name: "Suman Chaudhary", phones: phones("9841721695"), address: "Dhangadi" },
  { name: "Aarabh Raj Kumar Rana", phones: phones("9825670230"), address: "Dhangadi" },
  { name: "Radhe Shyam Kapar", phones: phones("9816848192"), address: "Dhanusha, Janakpur" },
  { name: "Manoj Kumar Yadav", phones: phones("9815889070"), address: "Banniya, Dhanusha" },
  { name: "Saroj Kumar Sah", phones: phones("9809493911"), address: "Mahottari" },
  { name: "Rajkumar Yadav", phones: phones("9748425311"), address: "Pokhara" },
  { name: "Awdhesh Kumar Yadav", phones: phones("9806704725"), address: "Bara-7" },
  { name: "Rajan Sah Teli", phones: phones("9827217933"), address: "Parsa-9" },
  { name: "Sanny Raut Kurmi", phones: phones("9806734846"), address: "Parsa-4" },
  { name: "Riya Shrestha", phones: phones("9847676588"), address: "Baglung-2" },
  { name: "Rupesh Kumar", phones: phones("9820200729"), address: "Pokhara" },
  { name: "Raushan Kumar", phones: phones("9745453206"), address: "Pokhara" },
  { name: "Sandip Kumar Mahato", phones: phones("9804850360"), address: "Mahottari-9" },
  { name: "Mahesh Kumar Mahato", phones: phones("9810116861"), address: "Mahottari-9" },
  { name: "Manak Kumar Mahato", phones: phones("9700355621"), address: "Mahottari-6" },
  { name: "Rajnarayan Sah", phones: phones("9826860805"), address: "Mahottari-4" },
  { name: "Daanis Rai", phones: phones("9812598545"), address: "Nepalgunj-11" },
  { name: "Jamil Ahamad Rai", phones: phones("9819506538"), address: "Nepalgunj" },
  { name: "Santosh Kori", phones: phones("9814523957"), address: "Banke-6" },
  { name: "Sujit Kanojiya", phones: phones("9819539401"), address: "Nepalgunj-11" },
  { name: "Raju Kori", phones: phones("9746532120"), address: "Nepalgunj-7" },
  { name: "Ayyub Rai", phones: phones("9804533211"), address: "Banke-2" },
  { name: "Anish Shekh", phones: phones("9812505326"), address: "Banke-3" },
  { name: "Ashish Maharjan", phones: phones("9860102148"), address: "Dhapakhel" },
  { name: "Amit Lama", phones: phones("9809185604"), address: "Birgunj, Parsa" },
  { name: "Kamal Ghole", phones: phones("9849555744"), address: "Sindhuli-3" },
  { name: "Subash Mahara", phones: phones("9848880902"), address: "Mahendranagar-06" },
  { name: "Narendra Joshi", phones: phones("9744354459"), address: "Mahendranagar-18" },
  { name: "Suresh Bhatt", phones: phones("9822395990"), address: "Mahendranagar-07" },
  { name: "Dhan Singh Rawal", phones: phones("9869509497"), address: "Mahendranagar-06" },
  { name: "Surrendra Bhatt", phones: phones("9848721268"), address: "Mahendranagar-03" },
];

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  assertSafeDatabaseWrite({ mongoUri, operation: "seed painters", destructive: false });
  console.log(`[db-write] ${describeDatabaseTarget(mongoUri)}`);

  await mongoose.connect(mongoUri);

  const existing = await Painter.countDocuments();
  if (existing > 0) {
    console.log(`Painters collection already has ${existing} record(s) - skipping seed to avoid duplicates.`);
    await mongoose.disconnect();
    return;
  }

  const inserted = await Painter.insertMany(PAINTERS, { ordered: true });
  console.log(`Painters seed complete - inserted ${inserted.length} records.`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Painters seed failed:", error.message || error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

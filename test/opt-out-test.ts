import { handleOptOutRequest } from "../api/optOut";
import { checkSuppression } from "../compliance/suppressionCheck";

// Edit this value before running: use your own email or phone.
const TEST_CONTACT = {
  email: "you@example.com"
};

async function main() {
  console.log("Testing opt-out for contact:", JSON.stringify(TEST_CONTACT, null, 2));

  const optOutResponse = await handleOptOutRequest(TEST_CONTACT);
  console.log("Opt-out response:", JSON.stringify(optOutResponse, null, 2));

  const suppressionResult = await checkSuppression(TEST_CONTACT);
  console.log("Suppression check after opt-out:", JSON.stringify(suppressionResult, null, 2));

  console.log(`Processing time recorded at end: ${optOutResponse.processingTimeMs}ms`);
}

main().catch((error: Error) => {
  console.error("Opt-out test failed:", error.message);
  process.exitCode = 1;
});

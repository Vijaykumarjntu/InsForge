import { S3Client, GetBucketCorsCommand, PutBucketCorsCommand, GetBucketVersioningCommand, PutBucketVersioningCommand, GetObjectTaggingCommand } from "@aws-sdk/client-s3";

// Configure client pointing directly to your live insforge-dev container port
const s3 = new S3Client({
  endpoint: "http://localhost:7130/storage/v1/s3", 
  region: "us-east-2",
  credentials: {
    accessKeyId: "mock-access-key",
    secretAccessKey: "mock-secret-key"
  },
  forcePathStyle: true
});

async function runTests() {
  const bucketName = "test-bucket";
  console.log("🚀 Starting S3 Gateway Integration Tests against Container... \n");

  try {
    // 1. Test PutBucketCors
    console.log("📡 Sending PutBucketCors...");
    await s3.send(new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [{ AllowedOrigins: ["*"], AllowedMethods: ["GET", "PUT"] }]
      }
    }));
    console.log("✅ PutBucketCors: SUCCESS\n");

    // 2. Test GetBucketCors
    console.log("📡 Sending GetBucketCors...");
    const corsRes = await s3.send(new GetBucketCorsCommand({ Bucket: bucketName }));
    console.log("✅ GetBucketCors: SUCCESS. Allowed Methods:", corsRes.CORSRules[0].AllowedMethods, "\n");

    // 3. Test PutBucketVersioning
    console.log("📡 Sending PutBucketVersioning...");
    await s3.send(new PutBucketVersioningCommand({
      Bucket: bucketName,
      VersioningConfiguration: { Status: "Enabled" }
    }));
    console.log("✅ PutBucketVersioning: SUCCESS\n");

    // 4. Test GetBucketVersioning
    console.log("📡 Sending GetBucketVersioning...");
    const versionRes = await s3.send(new GetBucketVersioningCommand({ Bucket: bucketName }));
    console.log("✅ GetBucketVersioning: SUCCESS. Status:", versionRes.Status, "\n");

    // 5. Test GetObjectTagging
    console.log("📡 Sending GetObjectTagging...");
    const tagRes = await s3.send(new GetObjectTaggingCommand({ Bucket: bucketName, Key: "blueprint.sql" }));
    console.log("✅ GetObjectTagging: SUCCESS. Found TagSet:", tagRes.TagSet, "\n");

    console.log("🏆 ALL NEW S3 GATEWAY OPERATIONS PASSED TRIUMPHANTLY!");
  } catch (error) {
    console.error("❌ Test Failed with Error:", error.message);
    console.log("\n💡 Note: If port 7130 refused connection, change the endpoint in the script to 7131 or 7132 to match the gateway container's exact assigned sub-port.");
  }
}

runTests();
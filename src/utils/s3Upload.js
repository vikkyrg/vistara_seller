import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_KEY,
  },
});

/**
 * Uploads a file to S3 and returns the public URL
 * @param {File} file - The file object to upload
 * @param {string} folder - Optional folder path in the bucket
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
export const uploadToS3 = async (file, folder = "sellerDocuments") => {
  if (!file) return null;

  // Generate a unique clean filename
  const timestamp = Date.now();
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const fileName = `${folder}/${timestamp}_${cleanFileName}`;

  const params = {
    Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
    Key: fileName,
    Body: await file.arrayBuffer(),
    ContentType: file.type,
  };

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Public URL construction
    return `https://${params.Bucket}.s3.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${fileName}`;
  } catch (error) {
    console.error("Full S3 Upload Error:", error);
    throw new Error(`S3 Upload failed: ${error.message}`);
  }
};

/**
 * Deletes a file from S3 using its public URL
 * @param {string} url - The S3 public URL
 * @returns {Promise<boolean>} - True if deleted successfully
 */
export const deleteFromS3 = async (url) => {
  if (!url) return false;

  try {
    const bucket = import.meta.env.VITE_AWS_BUCKET_NAME;
    const region = import.meta.env.VITE_AWS_REGION;
    const prefix = `https://${bucket}.s3.${region}.amazonaws.com/`;

    if (!url.startsWith(prefix)) {
      console.warn("URL does not match S3 prefix, skipping S3 delete:", url);
      return false;
    }

    const key = decodeURIComponent(url.substring(prefix.length));

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error("S3 Delete Error:", error);
    return false;
  }
};

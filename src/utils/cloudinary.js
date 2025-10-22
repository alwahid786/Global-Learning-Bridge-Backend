import cloudinary from "cloudinary";
import path from "path";
import DataURIParser from "datauri/parser.js";
import { getEnv } from "../configs/config.js";

export const getDataUri = (file) => {
  const parser = new DataURIParser();
  const extName = path.extname(file.originalname).toString();
  return parser.format(extName, file.buffer);
};

export const configureCloudinary = async () => {
  try {
    cloudinary.v2.config({
      cloud_name: getEnv("CLOUDINARY_CLIENT_NAME"),
      api_key: getEnv("CLOUDINARY_CLIENT_KEY"),
      api_secret: getEnv("CLOUDINARY_CLIENT_SECRET"),
    });
    console.log("Cloudinary configured successfully");
  } catch (error) {
    console.error("Error configuring Cloudinary:", error);
  }
};

// UPLOAD FILE ON CLOUDINARY
// =========================
export const uploadOnCloudinary = async (file, subFolder) => {
  try {
    const fileUrl = await getDataUri(file);
    let response = null;
    const cleanFolder = subFolder.trim().replace(/\s+/g, "_");

    if (cleanFolder) {
      subFolder = cleanFolder;
    }

    if (fileUrl?.content) {
      // detect file extension
      const extName = path.extname(file.originalname).toLowerCase();

      // default resource type
      let resourceType = "auto";

      // for pdf, excel, csv → use raw
      if ([".pdf", ".xls", ".xlsx", ".csv"].includes(extName)) {
        resourceType = "raw";
      }

      response = await cloudinary.v2.uploader.upload(fileUrl.content, {
        resource_type: resourceType,
        folder: `${getEnv("CLOUDINARY_FOLDER_NAME")}/${subFolder}`,
      });

      console.log(`File uploaded successfully on Cloudinary`);

      response.original_filename = file.originalname;
    }

    return response;
  } catch (error) {
    console.error("Error occurred while uploading file on Cloudinary", error);
    return null;
  }
};

// UPLOAD MULTIPLE FILES ON CLOUDINARY
// ====================================
export const uploadMultipleOnCloudinary = async (files, subFolder) => {
  try {
    const uploadPromises = files.map(async (file) => {
      const fileUrl = await getDataUri(file);
      const cleanFolder = subFolder.trim().replace(/\s+/g, "_");
      if (cleanFolder) {
        subFolder = cleanFolder;
      }
      if (fileUrl?.content) {
        const extName = path.extname(file.originalname).toLowerCase();
        let resourceType = "auto";

        if ([".pdf", ".xls", ".xlsx", ".csv"].includes(extName)) {
          resourceType = "raw";
        }

        const result = await cloudinary.v2.uploader.upload(fileUrl.content, {
          resource_type: resourceType,
          folder: `${getEnv("CLOUDINARY_FOLDER_NAME")}/${subFolder}`,
        });

        console.log(`File uploaded successfully on Cloudinary`);
        result.original_filename = file.originalname;
        return result;
      } else {
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter(Boolean);

    if (successfulUploads.length === files.length) {
      console.log(`All files uploaded successfully on Cloudinary`);
    } else {
      console.log(
        `${successfulUploads.length} out of ${files.length} files uploaded successfully.`
      );
    }

    return successfulUploads;
  } catch (error) {
    console.error("Error occurred while uploading files on Cloudinary", error);
    return [];
  }
};

// REMOVE FILE FROM CLOUDINARY
// ===========================
export const removeFromCloudinary = async (public_id, resourceType) => {
  try {
    console.log("fileName", public_id, resourceType);
    const response = await cloudinary.v2.uploader.destroy(public_id, {
      resource_type: resourceType,
    });
    console.log(`File deleted successfully from cloudinary`);
    return response;
  } catch (error) {
    console.error("Error occurred while removing file from Cloudinary", error);
    return null;
  }
};

// REMOVE MULTIPLE FILES FROM CLOUDINARY
// =====================================
export const removeMultipleFromCloudinary = async (
  public_ids,
  resourceType
) => {
  try {
    const resourceType = det;
    const response = await cloudinary.v2.api.delete_resources(public_ids, {
      resource_type: resourceType,
    });
    console.log(`Images deleted successfully from cloudinary`);
    return response;
  } catch (error) {
    console.error("Error occurred while removing files from Cloudinary", error);
    return null;
  }
};

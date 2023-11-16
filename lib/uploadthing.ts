// uploadthing's generateReactHelpers function is used to generate useUploadThing hook and the uploadFiles functions you use to interact with UploadThing in custom components. It takes your File Router as a generic

import { generateReactHelpers } from "@uploadthing/react/hooks";
 
import type { OurFileRouter } from "@/app/api/uploadthing/core";
 
export const { useUploadThing, uploadFiles } =
  generateReactHelpers<OurFileRouter>();
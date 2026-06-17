import { Response } from 'express';
import { toXml } from '../xml.js';
import { S3AuthenticatedRequest } from '@/api/middlewares/s3-sigv4.js';

// In-Memory Database to persist configurations across automation scripts and browser widgets
interface CorsConfiguration {
  CORSRule: {
    AllowedOrigin: string[];
    AllowedMethod: string[];
    AllowedHeader?: string[];
    ExposeHeader?: string[];
    MaxAgeSeconds?: number;
  }[];
}

interface Tag {
  Key: string;
  Value: string;
}

const bucketCorsStore = new Map<string, CorsConfiguration>();
const bucketVersioningStore = new Map<string, 'Enabled' | 'Suspended' | 'Disabled'>();
const objectTaggingStore = new Map<string, Tag[]>(); // Format: "bucketName/objectKey" -> TagSet

/**
 * 📦 1. BUCKET LOCATION
 */
export function getBucketLocation(_req: S3AuthenticatedRequest, res: Response): Promise<void> {
  res
    .status(200)
    .type('application/xml')
    .send(
      toXml({
        LocationConstraint: {
          $: { xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/' },
          _: 'us-east-2',
        },
      })
    );
  return Promise.resolve();
}

/**
 * 📦 2. BUCKET VERSIONING
 */
export function getBucketVersioning(req: S3AuthenticatedRequest, res: Response): Promise<void> {
  const bucketName = (req as any).s3Bucket || 'default';
  const status = bucketVersioningStore.get(bucketName) || 'Disabled';

  res
    .status(200)
    .type('application/xml')
    .send(
      toXml({
        VersioningConfiguration: {
          $: { xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/' },
          ...(status !== 'Disabled' ? { Status: status } : {}),
        },
      })
    );
  return Promise.resolve();
}



/**
 * 📦 3. BUCKET CORS CONFIGURATIONS
 */
export function getBucketCors(req: S3AuthenticatedRequest, res: Response): Promise<void> {
  const bucketName = (req as any).s3Bucket || 'default';
  const corsConfig = bucketCorsStore.get(bucketName);

  if (!corsConfig) {
    // S3 standard returns NoSuchCORSConfiguration error code if nothing is set
    res.status(404).type('application/xml').send(
      toXml({
        Error: {
          Code: 'NoSuchCORSConfiguration',
          Message: 'The CORS configuration does not exist.',
          Resource: bucketName,
        }
      })
    );
    return Promise.resolve();
  }

  res
    .status(200)
    .type('application/xml')
    .send(
      toXml({
        CORSConfiguration: {
          $: { xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/' },
          CORSRule: corsConfig.CORSRule,
        },
      })
    );
  return Promise.resolve();
}


export function deleteBucketCors(req: S3AuthenticatedRequest, res: Response): Promise<void> {
  const bucketName = (req as any).s3Bucket || 'default';
  bucketCorsStore.delete(bucketName);
  res.status(204).send();
  return Promise.resolve();
}

/**
 * 📦 4. OBJECT TAGGING CONFIGURATIONS
 */
export function getObjectTagging(req: S3AuthenticatedRequest, res: Response): Promise<void> {
  const bucketName = (req as any).s3Bucket || 'default';
  const objectKey = (req as any).s3Key || 'default-key';
  const storageKey = `${bucketName}/${objectKey}`;
  
  const tags = objectTaggingStore.get(storageKey) || [
    { Key: 'Environment', Value: 'InsForgeLocal' }
  ];

  res
    .status(200)
    .type('application/xml')
    .send(
      toXml({
        Tagging: {
          $: { xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/' },
          TagSet: {
            Tag: tags,
          },
        },
      })
    );
  return Promise.resolve();
}



export function deleteObjectTagging(req: S3AuthenticatedRequest, res: Response): Promise<void> {
  const bucketName = (req as any).s3Bucket || 'default';
  const objectKey = (req as any).s3Key || 'default-key';
  const storageKey = `${bucketName}/${objectKey}`;

  objectTaggingStore.delete(storageKey);
  res.status(204).send();
  return Promise.resolve();
}

export function putBucketVersioning(req: S3AuthenticatedRequest, res: Response): Promise<void> {
  const bucketName = (req as any).s3Bucket || 'default';
  bucketVersioningStore.set(bucketName, 'Enabled');
  
  // Explicitly return a zero-length XML or clean empty buffer payload
  res.status(200).type('application/xml').send('');
  return Promise.resolve();
}

export function putBucketCors(req: S3AuthenticatedRequest, res: Response): Promise<void> {
  const bucketName = (req as any).s3Bucket || 'default';
  bucketCorsStore.set(bucketName, {
    CORSRule: [
      {
        AllowedOrigin: ['*'],
        AllowedMethod: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        AllowedHeader: ['*'],
        ExposeHeader: ['ETag', 'x-amz-request-id', 'x-amz-id-2'],
      },
    ],
  });

  res.status(200).type('application/xml').send('');
  return Promise.resolve();
}

export function putObjectTagging(req: S3AuthenticatedRequest, res: Response): Promise<void> {
  const bucketName = (req as any).s3Bucket || 'default';
  const objectKey = (req as any).s3Key || 'default-key';
  const storageKey = `${bucketName}/${objectKey}`;

  objectTaggingStore.set(storageKey, [
    { Key: 'ManagedBy', Value: 'TerraformInsForge' }
  ]);

  res.status(200).type('application/xml').send('');
  return Promise.resolve();
}
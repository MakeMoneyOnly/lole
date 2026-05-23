import type { AppError } from '../errors';

/**
 * File metadata DTO
 */
export interface FileMetadata {
    id?: string;
    filename: string;
    contentType: string;
    size: number;
    etag?: string;
    createdAt?: Date;
    updatedAt?: Date;
    customMetadata?: Record<string, string>;
}

/**
 * Upload file input DTO
 */
export interface UploadFileInput {
    buffer: Buffer;
    filename: string;
    contentType: string;
    directory?: string;
    metadata?: Record<string, string>;
    makePublic?: boolean;
}

/**
 * Upload file output DTO
 */
export interface UploadFileOutput {
    url: string;
    metadata: FileMetadata;
}

/**
 * Download file output DTO
 */
export interface DownloadFileOutput {
    buffer: Buffer;
    metadata: FileMetadata;
}

/**
 * Delete file result
 */
export interface DeleteFileResult {
    deleted: boolean;
    fileId: string;
}

/**
 * List files input DTO
 */
export interface ListFilesInput {
    directory?: string;
    prefix?: string;
    maxResults?: number;
    pageToken?: string;
}

/**
 * List files output DTO
 */
export interface ListFilesOutput {
    files: FileMetadata[];
    nextPageToken?: string;
    hasMore: boolean;
}

/**
 * File validation result
 */
export interface FileValidationResult {
    valid: boolean;
    error?: AppError;
    metadata?: FileMetadata;
}

/**
 * Storage service configuration
 */
export interface StorageConfig {
    maxSize: number;
    allowedTypes: string[];
    allowedDirectories?: string[];
}

/**
 * File Storage Service Port
 * Defines the contract for file storage operations
 */
export interface FileStorageServicePort {
    /**
     * Upload a file
     * @param input - File upload data
     * @returns Upload result with URL
     * @throws AppError on failure
     */
    uploadFile(input: UploadFileInput): Promise<UploadFileOutput>;

    /**
     * Download a file
     * @param fileId - File identifier or URL
     * @returns File buffer and metadata
     * @throws AppError on failure
     */
    downloadFile(fileId: string): Promise<DownloadFileOutput>;

    /**
     * Delete a file
     * @param fileId - File identifier
     * @returns Deletion result
     * @throws AppError on failure
     */
    deleteFile(fileId: string): Promise<DeleteFileResult>;

    /**
     * Get file metadata
     * @param fileId - File identifier
     * @returns File metadata
     * @throws AppError on failure
     */
    getFileMetadata(fileId: string): Promise<FileMetadata>;

    /**
     * List files in a directory
     * @param input - List parameters
     * @returns List of files
     * @throws AppError on failure
     */
    listFiles(input?: ListFilesInput): Promise<ListFilesOutput>;

    /**
     * Generate a signed URL for file access
     * @param fileId - File identifier
     * @param expiresIn - Expiration time in seconds
     * @returns Signed URL
     * @throws AppError on failure
     */
    getSignedUrl(fileId: string, expiresIn?: number): Promise<string>;

    /**
     * Validate a file before upload
     * @param filename - File name
     * @param size - File size in bytes
     * @param contentType - MIME type
     * @param config - Storage configuration
     * @returns Validation result
     */
    validateFile(
        filename: string,
        size: number,
        contentType: string,
        config?: StorageConfig
    ): FileValidationResult;

    /**
     * Copy a file to a new location
     * @param sourceFileId - Source file identifier
     * @param destinationPath - Destination path
     * @returns New file URL and metadata
     * @throws AppError on failure
     */
    copyFile(sourceFileId: string, destinationPath: string): Promise<UploadFileOutput>;

    /**
     * Move a file to a new location
     * @param fileId - File identifier
     * @param destinationPath - Destination path
     * @returns New file URL and metadata
     * @throws AppError on failure
     */
    moveFile(fileId: string, destinationPath: string): Promise<UploadFileOutput>;
}

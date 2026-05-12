CREATE TABLE `chat_messages` (
	`id` varchar(36) NOT NULL,
	`conversation_id` varchar(36) NOT NULL,
	`sequence_no` int NOT NULL,
	`role` varchar(32) NOT NULL,
	`content` text NOT NULL,
	`name` varchar(255),
	`tool_call_id` varchar(255),
	`thinking` text,
	`usage_json` json,
	`tool_calls_json` json,
	`tool_results_json` json,
	`tool_errors_json` json,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_messages_conv_seq_uidx` UNIQUE(`conversation_id`,`sequence_no`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` varchar(36) NOT NULL,
	`title` text,
	`doc_names_json` json,
	`model_id` varchar(255),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_tree_snapshots` (
	`id` varchar(36) NOT NULL,
	`document_id` varchar(36) NOT NULL,
	`pageindex_status` varchar(255) NOT NULL,
	`tree_result` json NOT NULL,
	`fetched_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `document_tree_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_tree_snapshots_document_id_uidx` UNIQUE(`document_id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` varchar(36) NOT NULL,
	`pageindex_doc_id` varchar(512) NOT NULL,
	`s3_key` varchar(1024) NOT NULL,
	`original_filename` text NOT NULL,
	`content_type` varchar(255),
	`file_size_bytes` bigint,
	`status` varchar(255) NOT NULL DEFAULT '',
	`folder_id` varchar(255),
	`pageindex_created_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `documents_pageindex_doc_id_uidx` UNIQUE(`pageindex_doc_id`),
	CONSTRAINT `documents_s3_key_uidx` UNIQUE(`s3_key`)
);
--> statement-breakpoint
CREATE INDEX `documents_created_at_idx` ON `documents` (`created_at`);
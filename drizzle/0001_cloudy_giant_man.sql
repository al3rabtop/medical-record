CREATE TABLE `medicalDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `medicalDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `medicalResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`code` varchar(80) NOT NULL,
	`label` varchar(160) NOT NULL,
	`category` varchar(80) NOT NULL,
	`numericValue` decimal(12,3),
	`valueText` varchar(80) NOT NULL,
	`unit` varchar(32),
	`referenceRange` varchar(80),
	`status` enum('reassuring','follow_up','unavailable') NOT NULL DEFAULT 'unavailable',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `medicalResults_id` PRIMARY KEY(`id`),
	CONSTRAINT `medicalResults_visit_code_idx` UNIQUE(`visitId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `medicalVisits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitNumber` varchar(32) NOT NULL,
	`examDate` varchar(10) NOT NULL,
	`reportDate` varchar(10),
	`reportType` varchar(64) NOT NULL DEFAULT 'تحاليل مختبرية',
	`department` varchar(128),
	`physician` varchar(128),
	`source` varchar(128),
	`testCount` int NOT NULL DEFAULT 0,
	`abnormalCount` int NOT NULL DEFAULT 0,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `medicalVisits_id` PRIMARY KEY(`id`),
	CONSTRAINT `medicalVisits_visitNumber_unique` UNIQUE(`visitNumber`)
);
--> statement-breakpoint
ALTER TABLE `medicalDocuments` ADD CONSTRAINT `medicalDocuments_visitId_medicalVisits_id_fk` FOREIGN KEY (`visitId`) REFERENCES `medicalVisits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `medicalResults` ADD CONSTRAINT `medicalResults_visitId_medicalVisits_id_fk` FOREIGN KEY (`visitId`) REFERENCES `medicalVisits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `medicalDocuments_visit_idx` ON `medicalDocuments` (`visitId`);--> statement-breakpoint
CREATE INDEX `medicalResults_visit_idx` ON `medicalResults` (`visitId`);--> statement-breakpoint
CREATE INDEX `medicalResults_code_idx` ON `medicalResults` (`code`);--> statement-breakpoint
CREATE INDEX `medicalVisits_examDate_idx` ON `medicalVisits` (`examDate`);
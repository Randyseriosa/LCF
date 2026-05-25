SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict gkkyHo4RJRA4hq7y9XUi1RemUWyndCnLa7oB0aZUqboIFxToIkOb4Xwh8tyXHNn

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: class_of_vessel; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: equipments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: vessels; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "email", "role", "is_active", "created_at", "name", "avatar_url", "username") VALUES
	('2d74cf2d-c1bd-4e1b-86be-d2bd9de89e3e', 'admin@lcfpf.local', 'admin', 'active', '2026-05-19 13:11:01.989781+00', 'System Admin', NULL, 'admin');


--
-- Data for Name: monthly_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: monthly_report_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: vessel_item_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- PostgreSQL database dump complete
--

-- \unrestrict gkkyHo4RJRA4hq7y9XUi1RemUWyndCnLa7oB0aZUqboIFxToIkOb4Xwh8tyXHNn

RESET ALL;

// GCP infrastructure for the bms-vs deployment, as a Pulumi Go program.
//
// Manages everything the GitHub Actions deploy workflow depends on:
// enabled APIs, Artifact Registry (app images + a Docker Hub remote proxy
// for the turbo-cache image), private-service networking, Cloud SQL for
// SQL Server 2022 Express (private IP only), Secret Manager secrets,
// service accounts + IAM, Workload Identity Federation for GitHub
// Actions, the self-hosted Turborepo remote cache (GCS bucket + Cloud Run
// service), and a $300 budget alert.
//
// It deliberately does NOT manage the app's Cloud Run service and
// migrate-seed job: deploy.yml creates/updates those with gcloud on every
// merge to main, so their runtime config lives next to the pipeline that
// rolls them. Pulumi owns everything that changes rarely; CI owns what
// changes per release.
//
// Bootstrap (once, before `pulumi up` — Pulumi can't enable APIs on a
// project that doesn't exist): see README.md in this directory.
package main

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v9/go/gcp/artifactregistry"
	"github.com/pulumi/pulumi-gcp/sdk/v9/go/gcp/billing"
	"github.com/pulumi/pulumi-gcp/sdk/v9/go/gcp/cloudrunv2"
	"github.com/pulumi/pulumi-gcp/sdk/v9/go/gcp/compute"
	"github.com/pulumi/pulumi-gcp/sdk/v9/go/gcp/iam"
	"github.com/pulumi/pulumi-gcp/sdk/v9/go/gcp/organizations"
	"github.com/pulumi/pulumi-gcp/sdk/v9/go/gcp/projects"
	"github.com/pulumi/pulumi-gcp/sdk/v9/go/gcp/secretmanager"
	"github.com/pulumi/pulumi-gcp/sdk/v9/go/gcp/serviceaccount"
	"github.com/pulumi/pulumi-gcp/sdk/v9/go/gcp/servicenetworking"
	"github.com/pulumi/pulumi-gcp/sdk/v9/go/gcp/sql"
	"github.com/pulumi/pulumi-gcp/sdk/v9/go/gcp/storage"
	"github.com/pulumi/pulumi-random/sdk/v4/go/random"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		conf := config.New(ctx, "")
		gcpConf := config.New(ctx, "gcp")
		project := gcpConf.Require("project")
		region := gcpConf.Require("region")
		billingAccount := conf.Require("billingAccount")
		githubRepo := conf.Require("githubRepo")

		proj, err := organizations.LookupProject(ctx, &organizations.LookupProjectArgs{
			ProjectId: &project,
		})
		if err != nil {
			return err
		}
		projectNumber := proj.Number

		// ------------------------------------------------------------ APIs
		apiNames := []string{
			"run.googleapis.com",
			"sqladmin.googleapis.com",
			"artifactregistry.googleapis.com",
			"secretmanager.googleapis.com",
			"compute.googleapis.com",
			"servicenetworking.googleapis.com",
			"iam.googleapis.com",
			"iamcredentials.googleapis.com",
			"sts.googleapis.com",
			"billingbudgets.googleapis.com",
		}
		var apis []pulumi.Resource
		for _, name := range apiNames {
			svc, err := projects.NewService(ctx, name, &projects.ServiceArgs{
				Service: pulumi.String(name),
				// Keep APIs on if the stack is ever destroyed — disabling
				// them tears down dependent resources aggressively.
				DisableOnDestroy: pulumi.Bool(false),
			})
			if err != nil {
				return err
			}
			apis = append(apis, svc)
		}
		withApis := pulumi.DependsOn(apis)

		// ------------------------------------------------- Artifact Registry
		// `bms`: the app's web/jobs images, pushed by CI.
		if _, err := artifactregistry.NewRepository(ctx, "bms-repo", &artifactregistry.RepositoryArgs{
			RepositoryId: pulumi.String("bms"),
			Location:     pulumi.String(region),
			Format:       pulumi.String("DOCKER"),
			Description:  pulumi.String("bms-vs images (web, jobs)"),
		}, withApis); err != nil {
			return err
		}
		// `dockerhub`: a pull-through proxy so Cloud Run can run public
		// Docker Hub images (Cloud Run only pulls from Artifact Registry).
		dockerhub, err := artifactregistry.NewRepository(ctx, "dockerhub-remote", &artifactregistry.RepositoryArgs{
			RepositoryId: pulumi.String("dockerhub"),
			Location:     pulumi.String(region),
			Format:       pulumi.String("DOCKER"),
			Mode:         pulumi.String("REMOTE_REPOSITORY"),
			RemoteRepositoryConfig: &artifactregistry.RepositoryRemoteRepositoryConfigArgs{
				DockerRepository: &artifactregistry.RepositoryRemoteRepositoryConfigDockerRepositoryArgs{
					PublicRepository: pulumi.String("DOCKER_HUB"),
				},
			},
			Description: pulumi.String("Docker Hub pull-through cache"),
		}, withApis)
		if err != nil {
			return err
		}

		// -------------------------------------- private services access (VPC)
		// Required before a private-IP-only Cloud SQL instance can attach to
		// the default network.
		defaultNetwork := fmt.Sprintf("projects/%s/global/networks/default", project)
		peeringRange, err := compute.NewGlobalAddress(ctx, "psa-range", &compute.GlobalAddressArgs{
			Name:         pulumi.String("google-managed-services-default"),
			Purpose:      pulumi.String("VPC_PEERING"),
			AddressType:  pulumi.String("INTERNAL"),
			PrefixLength: pulumi.Int(16),
			Network:      pulumi.String(defaultNetwork),
		}, withApis)
		if err != nil {
			return err
		}
		psa, err := servicenetworking.NewConnection(ctx, "psa-connection", &servicenetworking.ConnectionArgs{
			Network:               pulumi.String(defaultNetwork),
			Service:               pulumi.String("servicenetworking.googleapis.com"),
			ReservedPeeringRanges: pulumi.StringArray{peeringRange.Name},
		})
		if err != nil {
			return err
		}

		// ----------------------------------------------------------- Cloud SQL
		// Express edition: no SQL Server license component in the price; its
		// 10 GB-per-DB cap is irrelevant for 198 seeded rows. Private IP only.
		rootPassword, err := random.NewRandomPassword(ctx, "sql-root-password", &random.RandomPasswordArgs{
			Length:  pulumi.Int(32),
			Special: pulumi.Bool(false),
		})
		if err != nil {
			return err
		}
		appDbPassword, err := random.NewRandomPassword(ctx, "sql-app-password", &random.RandomPasswordArgs{
			Length:  pulumi.Int(32),
			Special: pulumi.Bool(false),
		})
		if err != nil {
			return err
		}
		instance, err := sql.NewDatabaseInstance(ctx, "bms-sql", &sql.DatabaseInstanceArgs{
			Name:               pulumi.String("bms-sql"),
			Region:             pulumi.String(region),
			DatabaseVersion:    pulumi.String("SQLSERVER_2022_EXPRESS"),
			RootPassword:       rootPassword.Result,
			DeletionProtection: pulumi.Bool(false), // demo infra; teardown must stay one command
			Settings: &sql.DatabaseInstanceSettingsArgs{
				Tier: pulumi.String("db-custom-1-3840"), // smallest allowed for SQL Server
				IpConfiguration: &sql.DatabaseInstanceSettingsIpConfigurationArgs{
					Ipv4Enabled:    pulumi.Bool(false),
					PrivateNetwork: pulumi.String(defaultNetwork),
				},
				DiskSize: pulumi.Int(10),
				DiskType: pulumi.String("PD_SSD"),
			},
		}, pulumi.DependsOn([]pulumi.Resource{psa}))
		if err != nil {
			return err
		}
		if _, err := sql.NewDatabase(ctx, "bms-db", &sql.DatabaseArgs{
			Name:     pulumi.String("bms"),
			Instance: instance.Name,
		}); err != nil {
			return err
		}
		// The app connects as the built-in `sqlserver` user; Pulumi owns its
		// password so the DATABASE_URL secret below can embed it.
		if _, err := sql.NewUser(ctx, "sqlserver-user", &sql.UserArgs{
			Name:     pulumi.String("sqlserver"),
			Instance: instance.Name,
			Password: appDbPassword.Result,
		}); err != nil {
			return err
		}
		privateIp := instance.PrivateIpAddress

		// ------------------------------------------------------------ secrets
		authSecret, err := random.NewRandomPassword(ctx, "auth-secret", &random.RandomPasswordArgs{
			Length: pulumi.Int(44), Special: pulumi.Bool(false),
		})
		if err != nil {
			return err
		}
		appPin, err := random.NewRandomPassword(ctx, "app-pin", &random.RandomPasswordArgs{
			Length: pulumi.Int(32), Special: pulumi.Bool(false), Upper: pulumi.Bool(false),
		})
		if err != nil {
			return err
		}
		// encrypt=false: tedious rejects TLS SNI against a bare IP ("Setting
		// the TLS ServerName to an IP address is not permitted") and the
		// instance has no DNS name. Traffic never leaves the VPC (private IP
		// only) and GCP encrypts it at the network layer.
		databaseUrl := pulumi.Sprintf(
			"sqlserver://%s:1433;database=bms;user=sqlserver;password=%s;encrypt=false;trustServerCertificate=true",
			privateIp, appDbPassword.Result,
		)

		mkSecret := func(logical, secretId string, value pulumi.StringInput) (*secretmanager.Secret, error) {
			s, err := secretmanager.NewSecret(ctx, logical, &secretmanager.SecretArgs{
				SecretId:    pulumi.String(secretId),
				Replication: &secretmanager.SecretReplicationArgs{Auto: &secretmanager.SecretReplicationAutoArgs{}},
			}, withApis)
			if err != nil {
				return nil, err
			}
			if _, err := secretmanager.NewSecretVersion(ctx, logical+"-v", &secretmanager.SecretVersionArgs{
				Secret:     s.ID(),
				SecretData: value.ToStringOutput(),
			}); err != nil {
				return nil, err
			}
			return s, nil
		}
		dbUrlSecret, err := mkSecret("database-url", "bms-database-url", databaseUrl)
		if err != nil {
			return err
		}
		authSecretSecret, err := mkSecret("auth-secret-sm", "bms-auth-secret", authSecret.Result)
		if err != nil {
			return err
		}
		appPinSecret, err := mkSecret("app-pin-sm", "bms-app-pin", appPin.Result)
		if err != nil {
			return err
		}

		// --------------------------------------------------- service accounts
		runtimeSa, err := serviceaccount.NewAccount(ctx, "bms-runtime", &serviceaccount.AccountArgs{
			AccountId:   pulumi.String("bms-runtime"),
			DisplayName: pulumi.String("bms web + migrate-seed runtime"),
		}, withApis)
		if err != nil {
			return err
		}
		deploySa, err := serviceaccount.NewAccount(ctx, "github-deployer", &serviceaccount.AccountArgs{
			AccountId:   pulumi.String("github-deployer"),
			DisplayName: pulumi.String("GitHub Actions deployer (WIF)"),
		}, withApis)
		if err != nil {
			return err
		}
		cacheSa, err := serviceaccount.NewAccount(ctx, "turbo-cache", &serviceaccount.AccountArgs{
			AccountId:   pulumi.String("turbo-cache"),
			DisplayName: pulumi.String("Turborepo remote cache"),
		}, withApis)
		if err != nil {
			return err
		}

		runtimeMember := pulumi.Sprintf("serviceAccount:%s", runtimeSa.Email)
		deployMember := pulumi.Sprintf("serviceAccount:%s", deploySa.Email)

		for i, s := range []*secretmanager.Secret{dbUrlSecret, authSecretSecret, appPinSecret} {
			if _, err := secretmanager.NewSecretIamMember(ctx, fmt.Sprintf("runtime-secret-access-%d", i), &secretmanager.SecretIamMemberArgs{
				SecretId: s.SecretId,
				Role:     pulumi.String("roles/secretmanager.secretAccessor"),
				Member:   runtimeMember,
			}); err != nil {
				return err
			}
		}

		// run.admin (not developer): the first CI deploy must set the
		// public-access IAM policy (--allow-unauthenticated) on the service
		// it creates.
		for role, id := range map[string]string{
			"roles/run.admin":               "deployer-run-admin",
			"roles/artifactregistry.writer": "deployer-ar-writer",
		} {
			if _, err := projects.NewIAMMember(ctx, id, &projects.IAMMemberArgs{
				Project: pulumi.String(project),
				Role:    pulumi.String(role),
				Member:  deployMember,
			}); err != nil {
				return err
			}
		}
		// Deploying a service that runs-as bms-runtime requires actAs on it.
		if _, err := serviceaccount.NewIAMMember(ctx, "deployer-actas-runtime", &serviceaccount.IAMMemberArgs{
			ServiceAccountId: runtimeSa.Name,
			Role:             pulumi.String("roles/iam.serviceAccountUser"),
			Member:           deployMember,
		}); err != nil {
			return err
		}

		// ------------------------------------ Workload Identity Federation
		pool, err := iam.NewWorkloadIdentityPool(ctx, "github-pool", &iam.WorkloadIdentityPoolArgs{
			WorkloadIdentityPoolId: pulumi.String("github"),
			DisplayName:            pulumi.String("GitHub Actions"),
		}, withApis)
		if err != nil {
			return err
		}
		provider, err := iam.NewWorkloadIdentityPoolProvider(ctx, "github-oidc", &iam.WorkloadIdentityPoolProviderArgs{
			WorkloadIdentityPoolId:         pool.WorkloadIdentityPoolId,
			WorkloadIdentityPoolProviderId: pulumi.String("github-oidc"),
			Oidc: &iam.WorkloadIdentityPoolProviderOidcArgs{
				IssuerUri: pulumi.String("https://token.actions.githubusercontent.com"),
			},
			AttributeMapping: pulumi.StringMap{
				"google.subject":       pulumi.String("assertion.sub"),
				"attribute.repository": pulumi.String("assertion.repository"),
			},
			// Only this repo's workflows can impersonate the deployer.
			AttributeCondition: pulumi.String(fmt.Sprintf("assertion.repository == '%s'", githubRepo)),
		})
		if err != nil {
			return err
		}
		if _, err := serviceaccount.NewIAMMember(ctx, "deployer-wif", &serviceaccount.IAMMemberArgs{
			ServiceAccountId: deploySa.Name,
			Role:             pulumi.String("roles/iam.workloadIdentityUser"),
			Member: pulumi.Sprintf(
				"principalSet://iam.googleapis.com/projects/%s/locations/global/workloadIdentityPools/%s/attribute.repository/%s",
				projectNumber, pool.WorkloadIdentityPoolId, githubRepo,
			),
		}); err != nil {
			return err
		}

		// ------------------------------------------------ turbo remote cache
		bucket, err := storage.NewBucket(ctx, "turbo-cache-bucket", &storage.BucketArgs{
			Name:                     pulumi.Sprintf("%s-turbo-cache", project),
			Location:                 pulumi.String(region),
			UniformBucketLevelAccess: pulumi.Bool(true),
			PublicAccessPrevention:   pulumi.String("enforced"),
			LifecycleRules: storage.BucketLifecycleRuleArray{
				&storage.BucketLifecycleRuleArgs{
					Action:    &storage.BucketLifecycleRuleActionArgs{Type: pulumi.String("Delete")},
					Condition: &storage.BucketLifecycleRuleConditionArgs{Age: pulumi.Int(30)},
				},
			},
		}, withApis)
		if err != nil {
			return err
		}
		if _, err := storage.NewBucketIAMMember(ctx, "cache-sa-bucket-access", &storage.BucketIAMMemberArgs{
			Bucket: bucket.Name,
			Role:   pulumi.String("roles/storage.objectAdmin"),
			Member: pulumi.Sprintf("serviceAccount:%s", cacheSa.Email),
		}); err != nil {
			return err
		}

		turboToken, err := random.NewRandomPassword(ctx, "turbo-token", &random.RandomPasswordArgs{
			Length: pulumi.Int(64), Special: pulumi.Bool(false),
		})
		if err != nil {
			return err
		}
		cacheImage := pulumi.Sprintf(
			// Pinned exact — upstream publishes no major-version tag.
			"%s-docker.pkg.dev/%s/%s/ducktors/turborepo-remote-cache:2.11.2",
			region, project, dockerhub.RepositoryId,
		)
		cacheSvc, err := cloudrunv2.NewService(ctx, "turbo-cache-svc", &cloudrunv2.ServiceArgs{
			Name:     pulumi.String("turbo-cache"),
			Location: pulumi.String(region),
			Ingress:  pulumi.String("INGRESS_TRAFFIC_ALL"),
			Template: &cloudrunv2.ServiceTemplateArgs{
				ServiceAccount: cacheSa.Email,
				Scaling: &cloudrunv2.ServiceTemplateScalingArgs{
					MinInstanceCount: pulumi.Int(0),
					// Single writer assumption per the ducktors guide.
					MaxInstanceCount: pulumi.Int(1),
				},
				Containers: cloudrunv2.ServiceTemplateContainerArray{
					&cloudrunv2.ServiceTemplateContainerArgs{
						Image: cacheImage,
						Ports: &cloudrunv2.ServiceTemplateContainerPortsArgs{
							// http1, not h2c: the ducktors fastify server
							// speaks HTTP/1.1 — h2c end-to-end yields 502
							// "protocol error" from Cloud Run's proxy.
							Name:          pulumi.String("http1"),
							ContainerPort: pulumi.Int(3000),
						},
						Resources: &cloudrunv2.ServiceTemplateContainerResourcesArgs{
							Limits: pulumi.StringMap{"memory": pulumi.String("512Mi"), "cpu": pulumi.String("1")},
						},
						Envs: cloudrunv2.ServiceTemplateContainerEnvArray{
							&cloudrunv2.ServiceTemplateContainerEnvArgs{Name: pulumi.String("STORAGE_PROVIDER"), Value: pulumi.String("google-cloud-storage")},
							&cloudrunv2.ServiceTemplateContainerEnvArgs{Name: pulumi.String("STORAGE_PATH"), Value: bucket.Name},
							&cloudrunv2.ServiceTemplateContainerEnvArgs{Name: pulumi.String("GCS_PROJECT_ID"), Value: pulumi.String(project)},
							&cloudrunv2.ServiceTemplateContainerEnvArgs{Name: pulumi.String("TURBO_TOKEN"), Value: turboToken.Result},
						},
					},
				},
			},
		})
		if err != nil {
			return err
		}
		// Public URL; auth is the bearer TURBO_TOKEN checked by the app.
		if _, err := cloudrunv2.NewServiceIamMember(ctx, "cache-public", &cloudrunv2.ServiceIamMemberArgs{
			Name:     cacheSvc.Name,
			Location: pulumi.String(region),
			Role:     pulumi.String("roles/run.invoker"),
			Member:   pulumi.String("allUsers"),
		}); err != nil {
			return err
		}

		// -------------------------------------------------------------- budget
		if _, err := billing.NewBudget(ctx, "free-trial-guard", &billing.BudgetArgs{
			BillingAccount: pulumi.String(billingAccount),
			DisplayName:    pulumi.String("bms-vs free-trial guard"),
			Amount: &billing.BudgetAmountArgs{
				SpecifiedAmount: &billing.BudgetAmountSpecifiedAmountArgs{
					// Currency must match the billing account's (IDR);
					// ≈ the $300 free-trial credit at ~Rp16.3k/USD.
					Units: pulumi.String("5000000"),
				},
			},
			BudgetFilter: &billing.BudgetBudgetFilterArgs{
				Projects: pulumi.StringArray{pulumi.Sprintf("projects/%s", projectNumber)},
			},
			ThresholdRules: billing.BudgetThresholdRuleArray{
				&billing.BudgetThresholdRuleArgs{ThresholdPercent: pulumi.Float64(0.5)},
				&billing.BudgetThresholdRuleArgs{ThresholdPercent: pulumi.Float64(0.8)},
				&billing.BudgetThresholdRuleArgs{ThresholdPercent: pulumi.Float64(1.0)},
			},
		}, withApis); err != nil {
			return err
		}

		// ------------------------------------------------------------ outputs
		ctx.Export("wifProvider", pulumi.Sprintf(
			"projects/%s/locations/global/workloadIdentityPools/%s/providers/%s",
			projectNumber, pool.WorkloadIdentityPoolId, provider.WorkloadIdentityPoolProviderId,
		))
		ctx.Export("deployServiceAccount", deploySa.Email)
		ctx.Export("turboApi", cacheSvc.Uri)
		ctx.Export("turboToken", pulumi.ToSecret(turboToken.Result))
		ctx.Export("appPin", pulumi.ToSecret(appPin.Result))
		ctx.Export("sqlPrivateIp", privateIp)
		return nil
	})
}

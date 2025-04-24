pipeline {
    agent any // Run on any available agent configured with kubectl, docker

    environment {
        DOCKER_HUB_CREDS_ID = 'dockerhub-credentials' // ID of credentials stored in Jenkins
        // *** CHANGE THIS line with your Docker Hub username ***
        DOCKER_HUB_USER   = 'yourdockerhubusername'
        APP_NAME          = 'myapp'
        KUBECONFIG_PATH   = '/var/lib/jenkins/.kube/config' // Path where Ansible put kubeconfig
    }

    stages {
        stage('Initialize') {
            steps {
                script {
                    // Determine current live color by checking the service selector
                    // Ensure kubectl uses the correct config
                    def current_color_output = sh(script: "kubectl --kubeconfig=${env.KUBECONFIG_PATH} get service ${env.APP_NAME}-service -o=jsonpath='{.spec.selector.color}'", returnStdout: true).trim()

                    // Handle potential errors if service/selector doesn't exist yet (first run)
                    if (current_color_output && (current_color_output == 'blue' || current_color_output == 'green')) {
                       env.CURRENT_LIVE_COLOR = current_color_output
                    } else {
                       echo "WARN: Could not determine current live color from service selector or selector invalid ('${current_color_output}'). Defaulting to 'blue' as live."
                       env.CURRENT_LIVE_COLOR = 'blue'
                    }

                    env.NEXT_DEPLOY_COLOR = (env.CURRENT_LIVE_COLOR == 'blue') ? 'green' : 'blue'
                    env.IMAGE_TAG = "${env.DOCKER_HUB_USER}/${env.APP_NAME}:${env.BUILD_NUMBER}-${env.NEXT_DEPLOY_COLOR}"

                    echo "Current live color: ${env.CURRENT_LIVE_COLOR}"
                    echo "Deploying to inactive color: ${env.NEXT_DEPLOY_COLOR}"
                    echo "Image to build: ${env.IMAGE_TAG}"
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                echo "Building Docker image: ${env.IMAGE_TAG}"
                sh 'docker build -t ${IMAGE_TAG} .'
            }
        }

        stage('Push Image to Docker Hub') {
            steps {
                echo "Logging into Docker Hub..."
                withCredentials([usernamePassword(credentialsId: env.DOCKER_HUB_CREDS_ID, usernameVariable: 'DOCKER_USER_VAR', passwordVariable: 'DOCKER_PASS_VAR')]) {
                    sh "echo $DOCKER_PASS_VAR | docker login -u ${env.DOCKER_HUB_USER} --password-stdin"
                }
                echo "Pushing Docker image: ${env.IMAGE_TAG}"
                sh 'docker push ${IMAGE_TAG}'
            }
        }

        stage('Deploy to Kubernetes (Inactive Color)') {
            steps {
                script {
                    // Use the correct kubeconfig path for all kubectl commands
                    def kubeconfig = "--kubeconfig=${env.KUBECONFIG_PATH}"

                    echo "Deploying ${env.NEXT_DEPLOY_COLOR} version using image ${env.IMAGE_TAG}"

                    // Check if deployment exists, apply YAML if not (basic setup)
                    def deployment_exists = sh(script: "kubectl ${kubeconfig} get deployment ${env.APP_NAME}-${env.NEXT_DEPLOY_COLOR} --ignore-not-found", returnStatus: true) == 0
                    if (!deployment_exists) {
                       echo "Deployment ${env.APP_NAME}-${env.NEXT_DEPLOY_COLOR} not found, applying YAML from k8s/deployment-${env.NEXT_DEPLOY_COLOR}.yaml"
                       // Run the apply command, ignore errors with || true, comment moved outside
                       sh "kubectl ${kubeconfig} apply -f k8s/deployment-${env.NEXT_DEPLOY_COLOR}.yaml || true" // Ignore initial apply error
                       sleep 10 // Give deployment object time to stabilize before setting image
                    }

                    // Set the image on the specific deployment for the inactive color
                    sh "kubectl ${kubeconfig} set image deployment/${env.APP_NAME}-${env.NEXT_DEPLOY_COLOR} ${env.APP_NAME}=${env.IMAGE_TAG} --record"

                    // Wait for the deployment rollout to complete
                    echo "Waiting for rollout of ${env.APP_NAME}-${env.NEXT_DEPLOY_COLOR}..."
                    sh "kubectl ${kubeconfig} rollout status deployment/${env.APP_NAME}-${env.NEXT_DEPLOY_COLOR} --timeout=5m"
                }
            }
        }

        stage('Manual Approval for Traffic Switch') {
             steps {
                 timeout(time: 10, unit: 'MINUTES') { // Increased timeout
                     input message: "Switch live traffic from ${env.CURRENT_LIVE_COLOR} to ${env.NEXT_DEPLOY_COLOR} (Image: ${IMAGE_TAG})?"
                 }
             }
        }

        stage('Switch Live Traffic') {
             steps {
                 script {
                     // Use the correct kubeconfig path
                     def kubeconfig = "--kubeconfig=${env.KUBECONFIG_PATH}"
                     echo "Switching service selector to color=${env.NEXT_DEPLOY_COLOR}"
                     // Patch the service to change the selector label
                     def patch_cmd = "kubectl ${kubeconfig} patch service ${env.APP_NAME}-service -p '{\\\"spec\\\":{\\\"selector\\\":{\\\"color\\\":\\\"${env.NEXT_DEPLOY_COLOR}\\\"}}}'"
                     echo "Running patch command: ${patch_cmd}"
                     sh patch_cmd
                     echo "Service ${env.APP_NAME}-service switched to ${env.NEXT_DEPLOY_COLOR}"
                 }
             }
         }
    }

    post {
        always {
            echo 'Pipeline finished.'
            echo 'Logging out from Docker Hub'
            sh 'docker logout || true' // Ignore error if already logged out
        }
        success {
            echo 'Pipeline succeeded!'
        }
        failure {
            echo 'Pipeline failed!'
            echo "Consider manual check/rollback if needed."
            // echo "To rollback (if needed): kubectl patch service ${env.APP_NAME}-service -p '{\\\"spec\\\":{\\\"selector\\\":{\\\"color\\\":\\\"${env.CURRENT_LIVE_COLOR}\\\"}}}'"
        }
    }
}
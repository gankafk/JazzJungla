$BUCKET = "jazz-aws-s3-bucket"
$DISTRIBUTION_ID = "E9F7MBM1G2RW7"

aws s3 sync ./dist s3://$BUCKET --delete

aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
